import { clerkClient } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Application, {
  type ApplicantType,
  type IApplication,
  type IApplicantSnapshot,
  ensureApplicationIndexes,
} from "@/lib/models/Application";
import Job, { type IJob } from "@/lib/models/Job";
import Post, { type IPost } from "@/lib/models/Post";
import User from "@/lib/models/User";
import Profile from "@/lib/models/Profile";
import OnboardingDetails from "@/lib/models/OnboardingDetails";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ensureUserRecord } from "@/lib/utils/ensure-user";
import {
  bulkUpsertCalendarEvents,
  mapApplication,
} from "@/lib/services/calendar-event.service";

async function ensureApplicationStorageReady() {
  await dbConnect();
  await ensureApplicationIndexes();
}

// ─── Types returned to route handlers ───────────────────────────────────

export interface ApplicationListResult {
  applications: IApplication[];
  total: number;
}

export interface AppliedPostResult {
  post: mongoose.FlattenMaps<IPost> & { _id: mongoose.Types.ObjectId };
  application: IApplication;
  applicantCount: number;
}

export interface AppliedJobResult {
  job: mongoose.FlattenMaps<IJob> & { _id: mongoose.Types.ObjectId };
  application: IApplication;
}

export interface ApplicantPermissions {
  applicantId: mongoose.Types.ObjectId;
  applicantType: ApplicantType;
  canApplyToPosts: boolean;
  canApplyToJobs: boolean;
  role: "teacher" | "teacher_candidate" | "admin";
  status: "active" | "blocked" | "deleted";
}

export interface CreatePostApplicationParams {
  postId: string;
  applicantId: mongoose.Types.ObjectId;
  profileId: string;
  applicantType: ApplicantType;
  applicantSnapshot: IApplicantSnapshot;
  coverLetter?: string;
}

export interface CreateJobApplicationParams {
  jobIdPublic: string;
  applicantId: mongoose.Types.ObjectId;
  profileId: string;
  applicantType: ApplicantType;
  applicantSnapshot: IApplicantSnapshot;
  coverLetter?: string;
}

async function attachApplicantAvatars(
  applications: IApplication[],
): Promise<IApplication[]> {
  const uniqueApplicantIds = Array.from(
    new Set(
      applications.map((application) => application.applicantId?.toString()),
    ),
  ).filter(
    (applicantId): applicantId is string =>
      Boolean(applicantId) && mongoose.Types.ObjectId.isValid(applicantId),
  );

  if (uniqueApplicantIds.length === 0) {
    return applications;
  }

  const users = await User.find(
    {
      _id: mongoose.trusted({
        $in: uniqueApplicantIds.map(
          (applicantId) => new mongoose.Types.ObjectId(applicantId),
        ),
      }),
    },
    { _id: 1, clerkId: 1 },
  ).lean<Array<{ _id: mongoose.Types.ObjectId; clerkId?: string | null }>>();

  const applicantClerkIdMap = new Map(
    users.map((user) => [String(user._id), user.clerkId ?? null]),
  );
  const uniqueClerkIds = Array.from(
    new Set(
      users
        .map((user) => user.clerkId)
        .filter((clerkId): clerkId is string => Boolean(clerkId)),
    ),
  );

  const avatarMap = new Map<string, string | null>();

  if (uniqueClerkIds.length > 0) {
    const client = await clerkClient();
    const avatarEntries = await Promise.allSettled(
      uniqueClerkIds.map(async (clerkId) => {
        const clerkUser = await client.users.getUser(clerkId);
        return [clerkId, clerkUser.imageUrl ?? null] as const;
      }),
    );

    for (const entry of avatarEntries) {
      if (entry.status === "fulfilled") {
        avatarMap.set(entry.value[0], entry.value[1]);
      }
    }
  }

  return applications.map((application) => {
    const applicantId = application.applicantId?.toString();
    const applicantClerkId = applicantId
      ? applicantClerkIdMap.get(applicantId)
      : null;

    const nextApplication = {
      ...application,
      applicantSnapshot: {
        ...application.applicantSnapshot,
        avatarUrl: applicantClerkId
          ? (avatarMap.get(applicantClerkId) ??
            application.applicantSnapshot?.avatarUrl ??
            null)
          : (application.applicantSnapshot?.avatarUrl ?? null),
      },
    };

    return nextApplication as IApplication;
  });
}

async function attachApplicantDetails(
  applications: IApplication[],
): Promise<IApplication[]> {
  const profileIds = Array.from(
    new Set(applications.map((a) => a.profileId).filter(Boolean)),
  );

  const validObjectIds = profileIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const profiles = validObjectIds.length
    ? await Profile.find({
        _id: mongoose.trusted({ $in: validObjectIds }),
      }).lean()
    : [];

  const clerkIds = profiles.map((p) => p.clerkId).filter(Boolean) as string[];

  const onboardings = clerkIds.length
    ? await OnboardingDetails.find({
        clerkId: mongoose.trusted({ $in: clerkIds }),
      }).lean()
    : [];

  const profileMap = new Map(profiles.map((p) => [String(p._id), p]));
  const onboardingMap = new Map(
    onboardings.map((o) => [o.clerkId as string, o]),
  );

  return applications.map((app) => {
    const snap =
      app.applicantSnapshot || ({} as IApplicantSnapshot & Record<string, any>);
    const profile = profileMap.get(String(app.profileId));
    const onboarding = profile
      ? onboardingMap.get(profile.clerkId ?? "")
      : undefined;

    const board = snap.board ?? profile?.board ?? onboarding?.board ?? null;
    const qualification =
      snap.qualification ??
      profile?.qualification ??
      onboarding?.qualification ??
      null;
    const teachingExp =
      snap.teachingExp ??
      profile?.teachingExp ??
      onboarding?.teachingExp ??
      null;
    const address =
      snap.address ?? profile?.address ?? onboarding?.address ?? null;

    return {
      ...app,
      applicantSnapshot: {
        ...snap,
        board,
        qualification,
        teachingExp,
        address,
      },
    } as IApplication;
  });
}

function isCandidateApplicant(user: {
  role: "teacher" | "teacher_candidate" | "admin";
  plan?: { hasCandidateAccess?: boolean | null } | null;
}): boolean {
  return (
    user.role === "teacher_candidate" || Boolean(user.plan?.hasCandidateAccess)
  );
}

function generateApplicationId(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `APP-${time}-${random}`;
}

export async function getApplicantPermissionsByClerkId(
  clerkId: string,
  options: { ensureUser?: boolean } = {},
): Promise<ApplicantPermissions | null> {
  await dbConnect();

  const user = options.ensureUser
    ? await ensureUserRecord(clerkId)
    : await User.findOne({ clerkId }).lean<{
        _id: mongoose.Types.ObjectId;
        role: "teacher" | "teacher_candidate" | "admin";
        status: "active" | "blocked" | "deleted";
        plan?: { hasCandidateAccess?: boolean | null } | null;
      }>();

  if (!user) {
    return null;
  }

  const candidateApplicant = isCandidateApplicant(user);

  return {
    applicantId: user._id,
    applicantType: candidateApplicant ? "candidate" : "teacher",
    canApplyToPosts: user.role !== "admin",
    canApplyToJobs: candidateApplicant,
    role: user.role,
    status: user.status,
  };
}

export async function getAppliedPostIdsForApplicant(
  applicantId: mongoose.Types.ObjectId,
  postIds: string[],
): Promise<string[]> {
  await dbConnect();

  if (postIds.length === 0) {
    return [];
  }

  const appliedPostIds = await Application.distinct("postId", {
    applicantId,
    postId: mongoose.trusted({ $in: postIds }),
  });

  return appliedPostIds.filter(
    (postId): postId is string => typeof postId === "string",
  );
}

export async function getAppliedJobIdsForApplicant(
  applicantId: mongoose.Types.ObjectId,
  jobIdsPublic: string[],
): Promise<string[]> {
  await dbConnect();

  if (jobIdsPublic.length === 0) {
    return [];
  }

  const appliedJobIds = await Application.distinct("jobIdPublic", {
    applicantId,
    jobIdPublic: mongoose.trusted({ $in: jobIdsPublic }),
  });

  return appliedJobIds.filter(
    (jobIdPublic): jobIdPublic is string => typeof jobIdPublic === "string",
  );
}

/**
 * Get applicant counts for multiple jobs by their public jobId strings.
 * Returns a Map of jobId -> count.
 */
export async function getApplicantCountsByJobIds(
  jobIdsPublic: string[],
): Promise<Map<string, number>> {
  await dbConnect();

  if (jobIdsPublic.length === 0) {
    return new Map();
  }

  const counts = await Application.aggregate<{ _id: string; count: number }>([
    { $match: { jobIdPublic: mongoose.trusted({ $in: jobIdsPublic }) } },
    { $group: { _id: "$jobIdPublic", count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((entry) => [entry._id, entry.count]));
}

export async function getAppliedPostsForApplicant(
  applicantId: mongoose.Types.ObjectId,
): Promise<AppliedPostResult[]> {
  await dbConnect();

  const applications = (
    await Application.find({
      applicantId,
    })
      .sort({ appliedAt: -1 })
      .lean<IApplication[]>()
  ).filter((app) => app.postId && app.postId !== null);

  const postIds = applications
    .map((application) => application.postId)
    .filter((postId): postId is string => typeof postId === "string");

  if (postIds.length === 0) {
    return [];
  }
  const [posts, counts] = await Promise.all([
    Post.find({ postId: mongoose.trusted({ $in: postIds }) }).lean<
      Array<mongoose.FlattenMaps<IPost> & { _id: mongoose.Types.ObjectId }>
    >(),
    Application.aggregate<{ _id: string; count: number }>([
      { $match: { postId: mongoose.trusted({ $in: postIds }) } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
  ]);

  const postMap = new Map(posts.map((post) => [post.postId, post]));
  const countMap = new Map(counts.map((entry) => [entry._id, entry.count]));

  return applications
    .map((application) => {
      const postId = application.postId;
      if (!postId) {
        return null;
      }

      const post = postMap.get(postId);
      if (!post) {
        return null;
      }

      return {
        post,
        application,
        applicantCount: countMap.get(postId) ?? 0,
      };
    })
    .filter((entry): entry is AppliedPostResult => entry !== null);
}

export async function getAppliedJobsForApplicant(
  applicantId: mongoose.Types.ObjectId,
): Promise<AppliedJobResult[]> {
  await dbConnect();

  const applications = await Application.find({
    applicantId,
    jobIdPublic: mongoose.trusted({ $exists: true, $ne: null }),
  })
    .sort({ appliedAt: -1 })
    .lean<IApplication[]>();

  const jobIdsPublic = applications
    .map((application) => application.jobIdPublic)
    .filter(
      (jobIdPublic): jobIdPublic is string => typeof jobIdPublic === "string",
    );

  if (jobIdsPublic.length === 0) {
    return [];
  }
  const jobs = await Job.find({
    jobId: mongoose.trusted({ $in: jobIdsPublic }),
  }).lean<
    Array<mongoose.FlattenMaps<IJob> & { _id: mongoose.Types.ObjectId }>
  >();
  const jobMap = new Map(jobs.map((job) => [job.jobId, job]));

  return applications
    .map((application) => {
      const jobIdPublic = application.jobIdPublic;
      if (!jobIdPublic) {
        return null;
      }

      const job = jobMap.get(jobIdPublic);
      if (!job) {
        return null;
      }

      return {
        job,
        application,
      };
    })
    .filter((entry): entry is AppliedJobResult => entry !== null);
}

export async function hasAppliedToPost(
  applicantId: mongoose.Types.ObjectId,
  postId: string,
): Promise<boolean> {
  await dbConnect();

  const existing = await Application.exists({
    applicantId,
    postId,
    status: mongoose.trusted({ $ne: "withdrawn" }),
  });
  return Boolean(existing);
}

export async function hasAppliedToJob(
  applicantId: mongoose.Types.ObjectId,
  jobIdPublic: string,
): Promise<boolean> {
  await dbConnect();

  const existing = await Application.exists({ applicantId, jobIdPublic });
  return Boolean(existing);
}

export async function createPostApplication(
  input: CreatePostApplicationParams,
): Promise<IApplication> {
  await ensureApplicationStorageReady();

  const post = await Post.findOne({ postId: input.postId }).lean();
  if (!post) {
    throw new NotFoundError("Post");
  }
  if (post.status !== "open") {
    throw new ConflictError("This tuition post is not open for applications.");
  }

  const existing = await Application.findOne({
    postId: input.postId,
    applicantId: input.applicantId,
    applicantType: input.applicantType,
  }).lean<IApplication>();

  if (existing) {
    if (existing.status === "withdrawn") {
      const reactivated = await Application.findOneAndUpdate(
        {
          applicationId: existing.applicationId,
          status: "withdrawn",
        },
        {
          $set: {
            profileId: input.profileId,
            applicantSnapshot: input.applicantSnapshot,
            coverLetter: input.coverLetter,
            status: "applied",
            isActive: true,
            appliedAt: new Date(),
          },
          $unset: {
            declineMeta: 1,
            dcDate: 1,
            dcMeta: 1,
            gcMeta: 1,
            approvalMeta: 1,
          },
        },
        { new: true, runValidators: true },
      );

      if (!reactivated) {
        throw new ConflictError("Application state changed. Please try again.");
      }

      return reactivated;
    }

    throw new ConflictError("You have already applied to this tuition post.");
  }

  try {
    const application = await Application.create({
      applicationId: generateApplicationId(),
      postId: input.postId,
      applicantId: input.applicantId,
      profileId: input.profileId,
      applicantType: input.applicantType,
      applicantSnapshot: input.applicantSnapshot,
      coverLetter: input.coverLetter,
      status: "pending",
      isActive: true,
      appliedAt: new Date(),
    });

    return application;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ConflictError("You have already applied to this tuition post.");
    }
    throw error;
  }
}

export async function createJobApplication(
  input: CreateJobApplicationParams,
): Promise<IApplication> {
  await ensureApplicationStorageReady();

  const job = await Job.findOne({ jobId: input.jobIdPublic }).lean();
  if (!job) {
    throw new NotFoundError("Job");
  }
  if (job.status !== "open") {
    throw new ConflictError("This job is not open for applications.");
  }

  const existing = await Application.findOne({
    jobIdPublic: input.jobIdPublic,
    applicantId: input.applicantId,
  }).lean();

  if (existing) {
    throw new ConflictError("You have already applied to this job.");
  }

  try {
    const application = await Application.create({
      applicationId: generateApplicationId(),
      jobId: job._id,
      jobIdPublic: input.jobIdPublic,
      applicantId: input.applicantId,
      profileId: input.profileId,
      applicantType: input.applicantType,
      applicantSnapshot: input.applicantSnapshot,
      coverLetter: input.coverLetter,
      status: "applied",
      isActive: true,
      appliedAt: new Date(),
    });

    return application;
  } catch (error: any) {
    // Handle MongoDB duplicate key error (race condition)
    if (error.code === 11000) {
      throw new ConflictError("You have already applied to this job.");
    }
    throw error;
  }
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Get all applications for a tuition post by its postId string (e.g. "P-DDMMYYNN").
 */
export async function getApplicationsByPostId(
  postId: string,
): Promise<ApplicationListResult> {
  await dbConnect();

  const applications = await Application.find({ postId })
    .sort({ appliedAt: 1 })
    .lean<IApplication[]>();

  const enrichedApplications = await attachApplicantAvatars(applications);
  const detailedApplications =
    await attachApplicantDetails(enrichedApplications);

  return {
    applications: detailedApplications,
    total: detailedApplications.length,
  };
}

/**
 * Get all applications for a job post by its jobIdPublic string (e.g. "J-DDMMYYNN").
 */
export async function getApplicationsByJobIdPublic(
  jobIdPublic: string,
): Promise<ApplicationListResult> {
  await dbConnect();

  const applications = await Application.find({ jobIdPublic })
    .sort({ appliedAt: 1 })
    .lean<IApplication[]>();

  const enrichedApplications = await attachApplicantAvatars(applications);

  return {
    applications: enrichedApplications,
    total: enrichedApplications.length,
  };
}

/**
 * Get a single application by its applicationId string.
 */
export async function getApplicationByApplicationId(
  applicationId: string,
): Promise<IApplication> {
  await dbConnect();

  const application = await Application.findOne({ applicationId }).lean();
  if (!application) {
    throw new NotFoundError("Application");
  }

  const [enrichedApplication] = await attachApplicantAvatars([
    application as IApplication,
  ]);

  return enrichedApplication;
}

// ─── Delete Functions ───────────────────────────────────────────────────

/**
 * Delete specific applications by their applicationId strings.
 * Returns the count of deleted documents.
 */
export async function deleteApplicationsByIds(
  applicationIds: string[],
): Promise<number> {
  await dbConnect();

  const result = await Application.deleteMany({
    applicationId: mongoose.trusted({ $in: applicationIds }),
  });

  return result.deletedCount;
}

/**
 * Delete ALL applications for a tuition post by its postId string.
 * Returns the count of deleted documents.
 */
export async function deleteAllApplicationsByPostId(
  postId: string,
): Promise<number> {
  await dbConnect();

  const result = await Application.deleteMany({ postId });

  return result.deletedCount;
}

/**
 * Delete ALL applications for a job post by its jobIdPublic string.
 * Returns the count of deleted documents.
 */
export async function deleteAllApplicationsByJobIdPublic(
  jobIdPublic: string,
): Promise<number> {
  await dbConnect();

  const result = await Application.deleteMany({ jobIdPublic });

  return result.deletedCount;
}

// ─── Status Update Functions ────────────────────────────────────────────

export type UpdateableApplicationStatus =
  | "applied"
  | "pending"
  | "shortlisted"
  | "DC"
  | "GC"
  | "approved"
  | "decline"
  | "declined"
  | "withdrawn";

export interface UpdateApplicationStatusParams {
  applicationId: string;
  status: UpdateableApplicationStatus;
  adminId?: mongoose.Types.ObjectId;
  dcDate?: Date;
  gcDate?: Date;
  approvedAt?: Date;
  paymentDone?: boolean;
  /** When approving: manual date for post.paymentDate (paid) or post.tentativeDate (pending). */
  postPaymentDate?: Date;
  reason?: string;
}

const AUTO_DECLINE_MESSAGE =
  "Application auto-declined, someone above you in the application queue was selected";

/**
 * Update the status of an application.
 * Validates:
 * - Only one applicant per post can be in DC/GC status at a time
 * - DC status requires dcDate (must be future)
 * - GC status requires gcDate (must be future)
 * - decline status requires reason
 * - When approving, auto-declines all other applicants for the same post/job
 */
export async function updateApplicationStatus(
  params: UpdateApplicationStatusParams,
): Promise<IApplication> {
  await dbConnect();

  const {
    applicationId,
    status,
    adminId,
    dcDate,
    gcDate,
    approvedAt,
    paymentDone,
    postPaymentDate,
    reason,
  } = params;

  console.log("[updateApplicationStatus] Received params:", {
    applicationId,
    status,
    adminId: adminId?.toString(),
    dcDate,
    gcDate,
    paymentDone,
    postPaymentDate,
    reason,
  });

  const application = await Application.findOne({ applicationId });
  if (!application) {
    throw new NotFoundError("Application");
  }

  const now = new Date();

  // ─── Validation ───────────────────────────────────────────────────────

  // DC status requires dcDate in the future (for tuition posts only)
  if (status === "DC" && application.postId) {
    if (!dcDate) {
      throw new ConflictError("Demo class date is required for DC status");
    }
    if (dcDate <= now) {
      throw new ConflictError("Demo class date must be in the future");
    }

    // Check if another applicant is already in DC or GC status for this post
    const existingInProcess = await Application.findOne({
      postId: application.postId,
      applicationId: mongoose.trusted({ $ne: applicationId }),
      status: mongoose.trusted({ $in: ["DC", "GC"] }),
    }).lean();

    if (existingInProcess) {
      throw new ConflictError(
        "Another applicant is already in the evaluation process (DC/GC) for this post. Complete or revert their status first.",
      );
    }
  }

  // GC status requires gcDate in the future (for tuition posts only)
  if (status === "GC" && application.postId) {
    if (!gcDate) {
      throw new ConflictError(
        "Guardian confirmation date is required for GC status",
      );
    }
    if (gcDate <= now) {
      throw new ConflictError(
        "Guardian confirmation date must be in the future",
      );
    }

    // Check if another applicant is already in DC or GC status for this post
    const existingInProcess = await Application.findOne({
      postId: application.postId,
      applicationId: mongoose.trusted({ $ne: applicationId }),
      status: mongoose.trusted({ $in: ["DC", "GC"] }),
    }).lean();

    if (existingInProcess) {
      throw new ConflictError(
        "Another applicant is already in the evaluation process (DC/GC) for this post. Complete or revert their status first.",
      );
    }
  }

  // Job applications use pending -> shortlisted -> approved/declined.
  if (
    application.jobIdPublic &&
    !["pending", "shortlisted", "approved", "declined", "withdrawn"].includes(
      status,
    )
  ) {
    throw new ConflictError("Invalid status for a job application");
  }

  // decline requires reason
  if (status === "decline" || status === "declined") {
    if (!reason || reason.trim().length === 0) {
      throw new ConflictError(
        "A reason is required when declining an application",
      );
    }
  }

  // ─── Build update object ──────────────────────────────────────────────

  const updateData: Record<string, unknown> = { status };

  // Set DC meta when moving to DC
  console.log("[updateApplicationStatus] Before DC check:", {
    status,
    statusIsDC: status === "DC",
    dcDate,
    dcDateType: typeof dcDate,
    dcDateValue: dcDate instanceof Date ? dcDate.toISOString() : dcDate,
    adminId: adminId?.toString(),
    adminIdTruthy: !!adminId,
  });

  if (status === "DC" && dcDate && adminId) {
    console.log("[updateApplicationStatus] Setting dcMeta:", {
      scheduledDate: dcDate,
      setByAdminId: adminId,
      setAt: now,
    });
    updateData.dcDate = dcDate;
    updateData.dcMeta = {
      scheduledDate: dcDate,
      setByAdminId: adminId,
      setAt: now,
    };
  }

  // Set GC meta when moving to GC
  if (status === "GC" && gcDate && adminId) {
    updateData.gcMeta = {
      scheduledDate: gcDate,
      setByAdminId: adminId,
      setAt: now,
    };
  }

  // Set approval meta when approving
  if (status === "approved" && adminId) {
    updateData.approvalMeta = {
      approvedByAdminId: adminId,
      approvedAt: approvedAt ?? now,
    };
  }

  // Set decline meta when declining
  if ((status === "decline" || status === "declined") && adminId) {
    updateData.declineMeta = {
      reason: reason?.trim(),
      declinedByAdminId: adminId,
      declinedAt: now,
    };
  }

  // Clear locked metas when reverting from approved
  if (
    application.status === "approved" &&
    (status === "DC" || status === "GC" || status === "applied")
  ) {
    updateData.approvalMeta = null;
    // Clear old dates since they're expired - new ones will be set if provided
    if (status === "applied") {
      updateData.dcMeta = null;
      updateData.gcMeta = null;
    }
  }

  console.log("[updateApplicationStatus] Final updateData before DB update:", {
    updateData,
    updateDataStringified: JSON.stringify(updateData, null, 2),
  });

  const updated = await Application.findOneAndUpdate(
    { applicationId },
    { $set: updateData },
    { new: true, runValidators: true },
  ).lean<IApplication>();

  console.log("[updateApplicationStatus] DB Update Result:", {
    status: updated?.status,
    dcDate: updated?.dcDate,
    dcMeta: updated?.dcMeta,
    gcMeta: updated?.gcMeta,
  });

  if (!updated) {
    throw new NotFoundError("Application");
  }

  if (
    status === "approved" &&
    application.postId &&
    typeof paymentDone === "boolean"
  ) {
    const defaultTentative = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000);
    const paymentDate = paymentDone ? (postPaymentDate ?? now) : null;
    const tentativeDate = paymentDone
      ? null
      : (postPaymentDate ?? defaultTentative);
    await Post.updateOne(
      { postId: application.postId },
      {
        $set: {
          status: "closed",
          paymentstatus: paymentDone ? "done" : "pending",
          paymentDate,
          tentativeDate,
        },
      },
      { runValidators: true },
    );
  }

  if (
    status === "approved" &&
    application.postId &&
    typeof paymentDone !== "boolean"
  ) {
    await Post.updateOne(
      { postId: application.postId },
      {
        $set: {
          status: "closed",
        },
      },
      { runValidators: true },
    );
  }

  // ─── Auto-decline others when approved ────────────────────────────────

  if (status === "approved") {
    const filter: Record<string, unknown> = {
      applicationId: mongoose.trusted({ $ne: applicationId }),
      status: mongoose.trusted({
        $nin: ["approved", "decline", "auto_declined", "withdrawn"],
      }),
    };

    if (application.postId) {
      filter.postId = application.postId;
    } else if (application.jobIdPublic) {
      filter.jobIdPublic = application.jobIdPublic;
    }

    // Get the IDs of the applications that will be auto-declined BEFORE updating them
    const docsToDecline = (await Application.find(filter)
      .select("_id")
      .lean()) as any[];
    const docsToDeclineIds = docsToDecline.map((d) => d._id);

    await Application.updateMany(filter, {
      $set: {
        status: "auto_declined",
        declineMeta: {
          autoDeclinedBecauseApplicationId: application._id,
          declinedAt: now,
          reason: AUTO_DECLINE_MESSAGE,
        },
      },
    });

    // ── Sync auto-declined docs to calendar_events ────────────────────────
    try {
      if (docsToDeclineIds.length > 0) {
        const declined = (await Application.find({
          _id: { $in: docsToDeclineIds },
        }).lean()) as any[];
        const inputs = declined
          .map((d) => mapApplication(d))
          .filter((x): x is NonNullable<typeof x> => x !== null);
        await bulkUpsertCalendarEvents(inputs);
      }
    } catch (err) {
      console.error(
        "[applicationService] calendar bulk-upsert after auto-decline failed:",
        err,
      );
    }
  }

  // ─── Un-auto-decline others when reverting from approved ──────────────

  if (application.status === "approved" && status !== "approved") {
    if (application.postId) {
      await Post.updateOne(
        { postId: application.postId },
        {
          $set: {
            status: "open",
            paymentstatus: null,
            paymentDate: null,
            tentativeDate: null,
          },
        },
      );
    }

    // Revert auto-declined applications back to applied
    const filter: Record<string, unknown> = {
      status: "auto_declined",
      "declineMeta.autoDeclinedBecauseApplicationId": application._id,
    };

    if (application.postId) {
      filter.postId = application.postId;
    } else if (application.jobIdPublic) {
      filter.jobIdPublic = application.jobIdPublic;
    }

    // Get the IDs of the applications that will be reverted BEFORE updating them
    const docsToRevert = (await Application.find(filter)
      .select("_id")
      .lean()) as any[];
    const docsToRevertIds = docsToRevert.map((d) => d._id);

    await Application.updateMany(filter, {
      $set: {
        status: "applied",
        declineMeta: null,
      },
    });

    // ── Sync reverted docs to calendar_events ─────────────────────────────
    try {
      if (docsToRevertIds.length > 0) {
        const reverted = (await Application.find({
          _id: { $in: docsToRevertIds },
        }).lean()) as any[];
        const inputs = reverted
          .map((d) => mapApplication(d))
          .filter((x): x is NonNullable<typeof x> => x !== null);
        await bulkUpsertCalendarEvents(inputs);
      }
    } catch (err) {
      console.error(
        "[applicationService] calendar bulk-upsert after revert failed:",
        err,
      );
    }
  }

  return updated;
}

/**
 * Get an application by its applicationId string (for validation in routes).
 */
export async function getApplicationById(
  applicationId: string,
): Promise<IApplication | null> {
  await dbConnect();

  const application = await Application.findOne({ applicationId }).lean();
  if (!application) {
    return null;
  }

  const [enrichedApplication] = await attachApplicantAvatars([
    application as IApplication,
  ]);

  return enrichedApplication;
}
