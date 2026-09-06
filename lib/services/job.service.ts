import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Job, { type IJob } from "@/lib/models/Job";
import Enquiry from "@/lib/models/Enquiry";
import Referral from "@/lib/models/Referral";
import Invoice from "@/lib/models/Invoice";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { escapeRegex } from "@/lib/utils";
import {
  getAdminAuthorsByClerkIds,
  getAdminAuthorsByAdminIds,
  type AdminAuthorSummary,
} from "@/lib/services/admin-author.service";
import type {
  CreateJobInput,
  UpdateJobInput,
  ListJobsInput,
} from "@/lib/validations/job";

// ─── Types returned to route handlers ───────────────────────────────────

export interface PaginatedJobs {
  jobs: JobWithEnquiryReference[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type JobWithEnquiryReference = IJob & {
  enquiryReferenceId?: string | null;
  referralUserName?: string | null;
  referralPhoneNumber?: string | null;
  author?: AdminAuthorSummary | null;
  invoicePaymentStatus?: "paid" | "partial" | "unpaid";
  invoicePaymentDate?: Date;
};

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a unique job ID in the format `J-DDMMYYNN`.
 * NN is a 2-digit daily counter (00–99).
 */
async function generateJobId(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `J-${dd}${mm}${yy}`;

  const lastJob = await Job.findOne({
    jobId: mongoose.trusted({ $regex: `^${prefix}` }),
  })
    .sort({ jobId: -1 })
    .lean();

  let counter = 0;
  if (lastJob) {
    const lastCounter = parseInt(lastJob.jobId.slice(-2), 10);
    counter = lastCounter + 1;
  }

  if (counter > 99) {
    throw new ConflictError(
      "Daily job limit (100) reached. Please try again tomorrow.",
    );
  }

  return `${prefix}${String(counter).padStart(2, "0")}`;
}

async function attachEnquiryReferences<
  T extends { enquiryId?: mongoose.Types.ObjectId | string | null },
>(jobs: T[]): Promise<Array<T & { enquiryReferenceId: string | null }>> {
  const linkedEnquiryIds = Array.from(
    new Set(
      jobs
        .map((job) => job.enquiryId?.toString())
        .filter((enquiryId): enquiryId is string => Boolean(enquiryId)),
    ),
  );

  const enquiryObjectIds = linkedEnquiryIds
    .filter((enquiryId) => mongoose.Types.ObjectId.isValid(enquiryId))
    .map((enquiryId) => new mongoose.Types.ObjectId(enquiryId));

  if (enquiryObjectIds.length === 0) {
    return jobs.map((job) => ({ ...job, enquiryReferenceId: null }));
  }

  const enquiries = await Enquiry.find(
    { _id: mongoose.trusted({ $in: enquiryObjectIds }) },
    { enquiryId: 1 },
  ).lean();

  const enquiryMap = new Map(
    enquiries.map((enquiry) => [String(enquiry._id), enquiry.enquiryId]),
  );

  return jobs.map((job) => ({
    ...job,
    enquiryReferenceId: job.enquiryId
      ? (enquiryMap.get(String(job.enquiryId)) ?? null)
      : null,
  }));
}

async function attachJobAuthors<
  T extends {
    createdByAdminClerkId?: string | null;
    updatedByAdminClerkId?: string | null;
    createdByAdminId?: mongoose.Types.ObjectId | string | null;
    updatedByAdminId?: mongoose.Types.ObjectId | string | null;
  },
>(jobs: T[]): Promise<Array<T & { author: AdminAuthorSummary | null }>> {
  const clerkAuthorMap = await getAdminAuthorsByClerkIds(
    jobs
      .map((job) => job.createdByAdminClerkId ?? job.updatedByAdminClerkId)
      .filter((clerkId): clerkId is string => Boolean(clerkId)),
  );
  const adminAuthorMap = await getAdminAuthorsByAdminIds(
    jobs.map((job) => job.createdByAdminId ?? job.updatedByAdminId),
  );

  return jobs.map((job) => {
    const clerkId = job.createdByAdminClerkId ?? job.updatedByAdminClerkId;
    const adminId = (job.createdByAdminId ?? job.updatedByAdminId)?.toString();
    const clerkAuthor = clerkId ? (clerkAuthorMap.get(clerkId) ?? null) : null;
    const adminAuthor = adminId ? (adminAuthorMap.get(adminId) ?? null) : null;

    return {
      ...job,
      author: clerkAuthor ?? adminAuthor,
    };
  });
}

async function attachJobReferrals<T extends { jobId: string }>(
  jobs: T[],
): Promise<
  Array<
    T & { referralUserName: string | null; referralPhoneNumber: string | null }
  >
> {
  const jobIds = jobs.map((job) => job.jobId);
  if (jobIds.length === 0) {
    return jobs.map((job) => ({
      ...job,
      referralUserName: null,
      referralPhoneNumber: null,
    }));
  }

  const referrals = await Referral.find(
    { postId: mongoose.trusted({ $in: jobIds }) },
    { postId: 1, referralUserName: 1, referralPhoneNumber: 1 },
  ).lean();

  const referralMap = new Map(
    referrals.map((referral) => [referral.postId, referral]),
  );

  return jobs.map((job) => ({
    ...job,
    referralUserName: referralMap.get(job.jobId)?.referralUserName ?? null,
    referralPhoneNumber:
      referralMap.get(job.jobId)?.referralPhoneNumber ?? null,
  }));
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Create a new job post (admin-facing).
 * @returns The created job document.
 */
export async function createJob(input: CreateJobInput): Promise<IJob> {
  await dbConnect();

  const jobId = await generateJobId();

  const job = await Job.create({
    jobId,
    workType: input.workType,
    title: input.title,
    clientName: input.clientName,
    phoneNumber: input.phoneNumber,
    source: input.source,
    referralUserName: input.referralUserName,
    companyName: input.companyName,
    companyType: input.companyType,
    locationType: input.locationType,
    location: input.location,
    timing: input.timing,
    experience: input.experience,
    gender: input.gender,
    salary: input.salary,
    skillsRequired: input.skillsRequired,
    travelRequirements: input.travelRequirements,
    requiredQualification: input.requiredQualification,
    projectType: input.projectType,
    budget: input.budget,
    duration: input.duration,
    brief: input.brief,
    status: input.status ?? "open",
    commissionBasis: input.commissionBasis,
    academyCommissionPercentage: input.academyCommissionPercentage,
    settledAmount: input.settledAmount,
    enquiryId: input.enquiryId
      ? new mongoose.Types.ObjectId(input.enquiryId)
      : undefined,
    createdByAdminClerkId: input.createdByAdminClerkId,
    createdByAdminId: input.createdByAdminId
      ? new mongoose.Types.ObjectId(input.createdByAdminId)
      : undefined,
  });

  return job;
}

/**
 * Get a single job by its jobId field.
 */
export async function getJobByJobId(
  jobId: string,
): Promise<JobWithEnquiryReference> {
  await dbConnect();

  const job = await Job.findOne({ jobId }).lean<IJob>();
  if (!job) {
    throw new NotFoundError("Job");
  }

  const [jobWithEnquiryReference] = await attachEnquiryReferences([job]);
  const [jobWithReferral] = await attachJobReferrals([jobWithEnquiryReference]);
  const [enrichedJob] = await attachJobAuthors([jobWithReferral]);
  return enrichedJob;
}

/**
 * Get a single job by MongoDB _id.
 */
export async function getJobById(id: string): Promise<JobWithEnquiryReference> {
  await dbConnect();

  const job = await Job.findById(id).lean<IJob>();
  if (!job) {
    throw new NotFoundError("Job");
  }

  const [jobWithEnquiryReference] = await attachEnquiryReferences([job]);
  const [jobWithReferral] = await attachJobReferrals([jobWithEnquiryReference]);
  const [enrichedJob] = await attachJobAuthors([jobWithReferral]);
  return enrichedJob;
}

/**
 * List jobs with pagination, optional status filter, and search.
 */
export async function listJobs(input: ListJobsInput): Promise<PaginatedJobs> {
  await dbConnect();

  const { status, page, limit, search } = input;

  // Build filter
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") {
    filter.status = status;
  }
  if (search) {
    const searchRegex = mongoose.trusted({
      $regex: escapeRegex(search),
      $options: "i",
    });
    filter.$or = mongoose.trusted([
      { jobId: searchRegex },
      { title: searchRegex },
      { clientName: searchRegex },
      { phoneNumber: searchRegex },
      { location: searchRegex },
      { requiredQualification: searchRegex },
    ]);
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<IJob[]>(),
    Job.countDocuments(filter),
  ]);

  const jobsWithEnquiryReferences = await attachEnquiryReferences(jobs);
  const jobsWithReferrals = await attachJobReferrals(jobsWithEnquiryReferences);
  const enrichedJobs = await attachJobAuthors(jobsWithReferrals);
  const invoices = await Invoice.find({
    isLatest: true,
    postId: mongoose.trusted({ $in: jobs.map((job) => job.jobId) }),
  })
    .select("postId paymentStatus paymentDate")
    .lean();
  const invoiceMap = new Map(
    invoices.map((invoice) => [invoice.postId, invoice]),
  );

  return {
    jobs: enrichedJobs.map((job) => ({
      ...job,
      invoicePaymentStatus: invoiceMap.get(job.jobId)?.paymentStatus as
        | "paid"
        | "partial"
        | "unpaid"
        | undefined,
      invoicePaymentDate: invoiceMap.get(job.jobId)?.paymentDate,
    })) as JobWithEnquiryReference[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update a job by jobId.
 */
export async function updateJob(
  jobId: string,
  input: UpdateJobInput,
): Promise<IJob> {
  await dbConnect();

  const updateData: Record<string, unknown> = { ...input };

  // Convert string IDs to ObjectIds
  if (input.updatedByAdminId) {
    updateData.updatedByAdminId = new mongoose.Types.ObjectId(
      input.updatedByAdminId,
    );
  }
  if (input.updatedByAdminClerkId) {
    updateData.updatedByAdminClerkId = input.updatedByAdminClerkId;
  }
  if (input.enquiryId) {
    updateData.enquiryId = new mongoose.Types.ObjectId(input.enquiryId);
  }

  const job = await Job.findOneAndUpdate({ jobId }, updateData, {
    new: true,
    runValidators: true,
  }).lean<IJob>();

  if (!job) {
    throw new NotFoundError("Job");
  }

  return job;
}

/**
 * Delete a job by jobId.
 */
export async function deleteJob(jobId: string): Promise<void> {
  await dbConnect();

  const result = await Job.findOneAndDelete({ jobId });
  if (!result) {
    throw new NotFoundError("Job");
  }
}
