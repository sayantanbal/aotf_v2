import legacyTeacherMapping from "./legacy-teacher-mapping.js";

const { mapLegacyTeacherToProfile, mapLegacyTeacherToOnboarding } = legacyTeacherMapping;

/**
 * Seeds User + Profile (+ OnboardingDetails for migrated users) in the NEW
 * MongoDB from a Clerk user object. Mirrors app/api/v1/webhooks/clerk/route.ts.
 *
 * @param {import("mongodb").Db} db
 * @param {import("@clerk/backend").User} clerkUser
 * @param {Record<string, any> | null} [legacyTeacher]
 * @returns {Promise<{ action: "created" | "updated" | "skipped"; reason?: string }>}
 */
export async function seedClerkUserInMongo(db, clerkUser, legacyTeacher = null) {
  const metadata = clerkUser.publicMetadata ?? {};

  if (metadata.isAdmin === true) {
    return { action: "skipped", reason: "admin" };
  }

  const clerkId = clerkUser.id;
  const usersCol = db.collection("users");
  const profilesCol = db.collection("profiles");
  const onboardingCol = db.collection("onboardingdetails");

  let username = clerkUser.username?.toLowerCase().trim();
  if (!username) {
    const primaryEmail =
      clerkUser.emailAddresses?.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ??
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      "";

    const localPart = primaryEmail
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15);

    const suffix = clerkId.replace("user_", "").slice(-8);
    username = `${localPart || "user"}${suffix}`;
  }

  const legacyPlan =
    typeof metadata.legacyPlan === "string" ? metadata.legacyPlan : null;
  const role =
    metadata.role === "teacher_candidate" || legacyPlan === "teacher_candidate"
      ? "teacher_candidate"
      : "teacher";
  const planCurrent = role;

  const accountHolderName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    null;
  const avatarUrl = clerkUser.imageUrl || null;
  const now = new Date();

  let userDoc = await usersCol.findOne({
    $or: [{ clerkId }, { username }],
  });

  const isMigratedLegacy =
    metadata.migratedFromLegacy === true &&
    metadata.registrationFeeStatus === "paid";

  let action = "updated";

  if (userDoc) {
    const userUpdate = {
      clerkId,
      status: "active",
      updatedAt: now,
      onboardingCompleted: isMigratedLegacy ? true : metadata.onboardingCompleted === true,
      role,
      "plan.current": isMigratedLegacy ? (legacyPlan ?? planCurrent) : planCurrent,
      "plan.hasTuitionAccess": isMigratedLegacy ? true : false,
      "plan.hasCandidateAccess": false,
      "plan.activatedAt": isMigratedLegacy ? now : userDoc.plan?.activatedAt ?? null,
    };

    await usersCol.updateOne({ _id: userDoc._id }, { $set: userUpdate });
  } else {
    const insertResult = await usersCol.insertOne({
      clerkId,
      username,
      role,
      plan: {
        current: isMigratedLegacy ? (legacyPlan ?? planCurrent) : planCurrent,
        hasTuitionAccess: isMigratedLegacy ? true : false,
        hasCandidateAccess: false,
        activatedAt: isMigratedLegacy ? now : null,
      },
      onboardingCompleted: isMigratedLegacy ? true : metadata.onboardingCompleted === true,
      status: "active",
      registrationPaymentId: null,
      deletionWarningEmailSentAt: null,
      createdAt: now,
      updatedAt: now,
    });
    userDoc = { _id: insertResult.insertedId };
    action = "created";
  }

  const profileDefaults = {
    displayName: accountHolderName,
    bio: null,
    avatarUrl,
    location: null,
    websiteUrl: null,
    socialLinks: {},
    subjects: [],
    experience: null,
    isPublic: true,
    phone: null,
    whatsapp: null,
    address: null,
    teachingExp: null,
    jobExp: null,
    qualification: null,
    board: null,
  };

  const legacyProfilePatch = legacyTeacher
    ? mapLegacyTeacherToProfile(legacyTeacher, clerkId, username)
    : {};

  const profileDoc = await profilesCol.findOne({
    $or: [{ clerkId }, { username }],
  });

  if (profileDoc) {
    const profileUpdate = {
      clerkId,
      userId: userDoc._id,
      username,
      updatedAt: now,
      ...profileDefaults,
      ...legacyProfilePatch,
    };
    if (avatarUrl && !legacyProfilePatch.avatarUrl) {
      profileUpdate.avatarUrl = avatarUrl;
    }
    if (!profileDoc.displayName && accountHolderName) {
      profileUpdate.displayName = accountHolderName;
    }
    await profilesCol.updateOne({ _id: profileDoc._id }, { $set: profileUpdate });
  } else {
    await profilesCol.insertOne({
      userId: userDoc._id,
      clerkId,
      username,
      ...profileDefaults,
      ...legacyProfilePatch,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (isMigratedLegacy) {
    const onboardingDefaults = {
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
    };

    const onboardingPatch = legacyTeacher
      ? mapLegacyTeacherToOnboarding(legacyTeacher)
      : {};

    await onboardingCol.updateOne(
      { $or: [{ clerkId }, { userId: userDoc._id }] },
      {
        $set: {
          ...onboardingDefaults,
          ...onboardingPatch,
          userId: userDoc._id,
          clerkId,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  return { action };
}
