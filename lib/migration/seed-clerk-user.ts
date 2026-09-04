import mongoose from "mongoose";
import User from "@/lib/models/User";
import Profile from "@/lib/models/Profile";
import OnboardingDetails from "@/lib/models/OnboardingDetails";
import { isClerkAdmin } from "@/lib/migration/clerk-user-filters";

/** Minimal Clerk user shape — avoids @clerk/backend version mismatches across packages. */
export type ClerkUserSeedInput = {
  id: string;
  username: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
  fullName: string | null;
  imageUrl: string;
  publicMetadata: Record<string, unknown>;
};

export type SeedResult = {
  action: "created" | "updated" | "skipped";
  reason?: string;
};

export { isAppClerkUser } from "@/lib/migration/clerk-user-filters";

function deriveUsername(clerkUser: ClerkUserSeedInput): string {
  const raw = clerkUser.username?.toLowerCase().trim();
  if (raw) return raw;

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    "";

  const localPart = primaryEmail
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 15);

  const suffix = clerkUser.id.replace("user_", "").slice(-8);
  return `${localPart || "user"}${suffix}`;
}

/** Mirrors the Clerk user.created webhook — upserts User, Profile, OnboardingDetails. */
export async function seedClerkUserInMongo(
  clerkUser: ClerkUserSeedInput,
  options?: {
    phone?: string | null;
    whatsapp?: string | null;
    createdByAdminClerkId?: string | null;
    createdByAdmin?: boolean;
    paymentCompleted?: boolean;
    useTransaction?: boolean;
  },
): Promise<SeedResult> {
  const metadata = clerkUser.publicMetadata ?? {};

  if (isClerkAdmin(metadata as Record<string, unknown>)) {
    return { action: "skipped", reason: "admin" };
  }

  const clerkId = clerkUser.id;

  const existingUser = await User.findOne({ clerkId }).select("_id").lean();
  if (existingUser) {
    return { action: "skipped", reason: "already_synced" };
  }

  const username = deriveUsername(clerkUser);
  const legacyPlan =
    typeof metadata.legacyPlan === "string" ? metadata.legacyPlan : null;
  const role =
    metadata.role === "teacher_candidate" || legacyPlan === "teacher_candidate"
      ? "teacher_candidate"
      : "teacher";
  const planCurrent = role;

  const accountHolderName = clerkUser.fullName?.trim() || null;
  const avatarUrl = clerkUser.imageUrl || null;

  let action: SeedResult["action"] = "updated";

  const persist = async (session?: mongoose.ClientSession) => {
    const writeOptions = session ? { session } : {};
    let userDoc = await User.findOneAndUpdate(
      { $or: [{ clerkId }, { username }] },
      { $set: { clerkId, status: "active" } },
      { returnDocument: "after", ...writeOptions },
    );

    if (!userDoc) {
      const paymentComplete =
        options?.paymentCompleted ?? metadata.paymentCompleted === true;
      const created = await User.create(
        [
          {
            clerkId,
            username,
            role,
            createdByAdmin: !!options?.createdByAdmin,
            createdByAdminClerkId: options?.createdByAdminClerkId ?? null,
            detailsCompleted: metadata.detailsCompleted === true,
            paymentCompleted: paymentComplete,
            whatsappGroupCompleted: metadata.whatsappGroupCompleted === true,
            plan: {
              current: planCurrent,
              hasTuitionAccess: true,
              hasCandidateAccess: planCurrent === "teacher_candidate",
              activatedAt: null,
            },
            onboardingCompleted:
              metadata.onboardingCompleted === true ||
              (metadata.detailsCompleted === true &&
                paymentComplete &&
                metadata.whatsappGroupCompleted === true),
            status: "active",
            registrationPaymentId: null,
          },
        ],
        writeOptions,
      );
      userDoc = created[0];
      action = "created";
    }

    const existingProfile = await Profile.findOneAndUpdate(
      { $or: [{ clerkId }, { username }] },
      { $set: { clerkId, userId: userDoc._id } },
      { returnDocument: "after", ...writeOptions },
    );

    if (!existingProfile) {
      await Profile.create(
        [
          {
            userId: userDoc._id,
            clerkId,
            username,
            displayName: accountHolderName,
            bio: null,
            avatarUrl,
            location: null,
            websiteUrl: null,
            socialLinks: {},
            subjects: [],
            experience: null,
            isPublic: true,
            phone: options?.phone ?? null,
            whatsapp: options?.whatsapp ?? options?.phone ?? null,
          },
        ],
        writeOptions,
      );
    } else {
      const profileUpdate: Record<string, unknown> = {};
      if (avatarUrl) profileUpdate.avatarUrl = avatarUrl;
      if (!existingProfile.displayName && accountHolderName) {
        profileUpdate.displayName = accountHolderName;
      }
      if (options?.phone) {
        profileUpdate.phone = options.phone;
        profileUpdate.whatsapp = options.whatsapp ?? options.phone;
      }
      if (Object.keys(profileUpdate).length > 0) {
        await Profile.updateOne(
          { _id: existingProfile._id },
          { $set: profileUpdate },
          writeOptions,
        );
      }
    }

    const isMigratedLegacy =
      metadata.migratedFromLegacy === true &&
      metadata.registrationFeeStatus === "paid";

    if (isMigratedLegacy) {
      await OnboardingDetails.findOneAndUpdate(
        { clerkId },
        {
          $setOnInsert: {
            userId: userDoc._id,
            clerkId,
            phone: null,
            whatsapp: null,
            address: null,
            teachingExp: null,
            jobExp: null,
            qualification: null,
            board: null,
            plan: legacyPlan ?? planCurrent,
            status: "incomplete",
            expiresAt: null,
          },
        },
        { upsert: true, ...writeOptions },
      );
    }
  };

  if (options?.useTransaction === false) {
    await persist();
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => persist(session));
    } finally {
      await session.endSession();
    }
  }

  return { action };
}
