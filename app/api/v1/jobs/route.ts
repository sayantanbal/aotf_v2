import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  checkCsrfOrigin,
  checkRateLimit,
  getClientIp,
  checkJsonContentType,
} from "@/lib/api-utils";
import Admin from "@/lib/models/Admin";
import Source from "@/lib/models/Source";
import Referral from "@/lib/models/Referral";
import dbConnect from "@/lib/db";
import { createJobSchema, listJobsSchema } from "@/lib/validations/job";
import { sourceLists } from "@/lib/validations/forms";
import { createJob, listJobs } from "@/lib/services/job.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { logActivity } from "@/lib/admin/logActivity";
import { updateEnquiryStatus } from "@/lib/services/enquiry.service";

/** 10 job creations per IP per minute */
const createLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** 60 reads per IP per minute */
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/**
 * POST /api/v1/jobs
 * Admin-facing: create a new job post.
 *
 * Request body: CreateJobInput
 *
 * Success 201:
 *   { message: string, job: IJob }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // CSRF origin check
    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    // Content-Type check
    const ctBlock = checkJsonContentType(request);
    if (ctBlock) return ctBlock;

    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(createLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    await dbConnect();
    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = createJobSchema.parse(body);
    const dbSources = await Source.find().lean();
    const allowedSourceKeys = new Set([
      ...sourceLists.map((source) => source.key),
      ...dbSources.map((source) => source.key),
    ]);
    if (!allowedSourceKeys.has(input.source)) {
      return NextResponse.json(
        { error: `Invalid source: ${input.source}` },
        { status: 400 },
      );
    }
    if (
      input.source === "referral" &&
      (!input.referralUserName?.trim() || !input.referralPhoneNumber?.trim())
    ) {
      return NextResponse.json(
        {
          error:
            "Referral user name and phone number are required when source is referral",
        },
        { status: 400 },
      );
    }
    const job = await createJob({
      ...input,
      createdByAdminClerkId: currentAdmin.clerkId,
      createdByAdminId: currentAdmin._id.toString(),
    });

    if (input.source === "referral" && input.referralUserName?.trim()) {
      await Referral.create({
        postId: job.jobId,
        referralUserName: input.referralUserName.trim(),
        referralPhoneNumber: input.referralPhoneNumber!.trim(),
        createdByAdminClerkId: currentAdmin.clerkId,
      });
    }

    if (input.enquiryId) {
      await updateEnquiryStatus(input.enquiryId, {
        toStatus: "resolved",
        action: `Enquiry converted to job ${job.jobId}`,
        notes: `Converted to job ${job.jobId}`,
        adminId: currentAdmin._id.toString(),
        adminName: currentAdmin.name ?? currentAdmin.username ?? "Admin",
        adminRole:
          currentAdmin.role === "support_admin"
            ? "support_admin"
            : currentAdmin.role === "admin"
              ? "admin"
              : "super_admin",
      });
    }

    await logActivity({
      admin: currentAdmin,
      action: "CREATE_JOB",
      module: "CRM",
      targetType: "Job",
      targetId: job._id as mongoose.Types.ObjectId,
      targetRefId: job.jobId,
      metadata: {
        jobId: job.jobId,
        ...(input.enquiryId ? { enquiryId: input.enquiryId } : {}),
      },
    });

    return NextResponse.json(
      { message: "Job created successfully", job },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/v1/jobs");
  }
}

/**
 * GET /api/v1/jobs
 * Public/Admin: list jobs with pagination, status filter, and search.
 *
 * Query params:
 *   status? — one of the job statuses or "all" (default "all")
 *   page?   — 1-based page number (default 1)
 *   limit?  — items per page, max 100 (default 10)
 *   search? — search term
 *
 * Success 200:
 *   { jobs: IJob[], pagination: { page, limit, total, totalPages } }
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(readLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { searchParams } = new URL(request.url);
    const input = listJobsSchema.parse({
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? 10,
      search: searchParams.get("search") ?? undefined,
    });

    const result = await listJobs(input);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/jobs");
  }
}
