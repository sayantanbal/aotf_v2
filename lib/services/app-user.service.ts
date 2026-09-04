import { clerkClient } from "@clerk/nextjs/server";
import { makeClerkUsername, splitFullName } from "@/lib/utils/clerk-username";
import { seedClerkUserInMongo } from "@/lib/migration/seed-clerk-user";
import User from "@/lib/models/User";

export type AdminCreateAppUserRole = "teacher" | "candidate";

export type CreateAppUserInput = {
  name: string;
  email: string;
  role: AdminCreateAppUserRole;
  legalAcceptedAt: string;
  creatorClerkId?: string;
};

export type CreateAppUserResult =
  | {
      success: true;
      userId: string;
      clerkId: string;
      username: string;
      role: "teacher" | "teacher_candidate";
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

function toDbRole(
  role: AdminCreateAppUserRole,
): "teacher" | "teacher_candidate" {
  return role === "candidate" ? "teacher_candidate" : "teacher";
}

function buildPublicMetadata(role: AdminCreateAppUserRole) {
  const dbRole = toDbRole(role);
  return {
    role: dbRole,
    onboardingCompleted: false,
    detailsCompleted: false,
    paymentCompleted: true,
    whatsappGroupCompleted: false,
    createdByAdmin: true,
    hasTuitionAccess: true,
    hasCandidateAccess: dbRole === "teacher_candidate",
  };
}

function isUsernameConflict(error: unknown) {
  const err = error as {
    errors?: Array<{ code?: string; meta?: { paramName?: string } }>;
  };
  return (
    err.errors?.some(
      (e) =>
        e.code === "form_identifier_exists" ||
        (e.meta?.paramName === "username" &&
          e.code === "form_identifier_exists"),
    ) ?? false
  );
}

export async function createAppUser(
  input: CreateAppUserInput,
): Promise<CreateAppUserResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const { firstName, lastName } = splitFullName(name);
  const dbRole = toDbRole(input.role);
  const client = await clerkClient();

  const existing = await client.users.getUserList({ emailAddress: [email] });
  if (existing.totalCount > 0) {
    const existingClerkUser = existing.data[0];
    const existingMongoUser = await User.findOne({
      clerkId: existingClerkUser.id,
    })
      .select("_id")
      .lean();

    // A previous admin attempt may have created Clerk successfully but failed
    // before Mongo provisioning. Repair that account on retry.
    const existingMetadata = existingClerkUser.publicMetadata as Record<
      string,
      unknown
    >;
    if (
      !existingMongoUser &&
      existingMetadata.role === dbRole &&
      existingMetadata.paymentCompleted === true
    ) {
      await seedClerkUserInMongo(existingClerkUser, {
        createdByAdminClerkId: input.creatorClerkId ?? null,
        createdByAdmin: true,
        paymentCompleted: true,
        useTransaction: false,
      });

      const repairedUser = await User.findOne({
        clerkId: existingClerkUser.id,
      })
        .select("_id username role")
        .lean();
      if (repairedUser) {
        return {
          success: true,
          userId: String(repairedUser._id),
          clerkId: existingClerkUser.id,
          username: repairedUser.username,
          role: dbRole,
        };
      }
    }

    return {
      success: false,
      error: "A user with this email already exists in Clerk",
      code: "duplicate_email",
    };
  }

  let clerkUser = null;
  for (let attempt = 0; attempt <= 9; attempt++) {
    const username = makeClerkUsername(email, attempt);
    try {
      clerkUser = await client.users.createUser({
        emailAddress: [email],
        username,
        firstName,
        lastName,
        skipPasswordChecks: true,
        skipPasswordRequirement: true,
        legalAcceptedAt: new Date(input.legalAcceptedAt),
        publicMetadata: buildPublicMetadata(input.role),
      });
      break;
    } catch (error) {
      if (!isUsernameConflict(error) || attempt === 9) {
        const message =
          (
            error as {
              errors?: Array<{ longMessage?: string; message?: string }>;
            }
          ).errors?.[0]?.longMessage ??
          (error as { errors?: Array<{ message?: string }> }).errors?.[0]
            ?.message ??
          "Failed to create user in Clerk";
        return { success: false, error: message, code: "clerk_error" };
      }
    }
  }

  if (!clerkUser) {
    return {
      success: false,
      error: "Failed to create user in Clerk",
      code: "clerk_error",
    };
  }

  const seedResult = await seedClerkUserInMongo(clerkUser, {
    createdByAdminClerkId: input.creatorClerkId ?? null,
    createdByAdmin: Boolean(input.creatorClerkId),
    paymentCompleted: Boolean(input.creatorClerkId),
    // Admin-created accounts are provisioned without a transaction so local
    // standalone MongoDB instances still receive the User and Profile records.
    useTransaction: false,
  });

  if (
    seedResult.action === "skipped" &&
    seedResult.reason !== "already_synced"
  ) {
    return {
      success: false,
      error: `User was not created: ${seedResult.reason ?? "unknown"}`,
      code: seedResult.reason,
    };
  }

  const userDoc = await User.findOne({ clerkId: clerkUser.id }).lean();
  if (!userDoc) {
    return {
      success: false,
      error: "Clerk user created but MongoDB record is missing",
      code: "seed_failed",
    };
  }

  return {
    success: true,
    userId: String(userDoc._id),
    clerkId: clerkUser.id,
    username: userDoc.username,
    role: dbRole,
  };
}
