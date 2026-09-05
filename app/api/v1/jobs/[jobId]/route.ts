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
import Referral from "@/lib/models/Referral";
import dbConnect from "@/lib/db";
import { updateJobSchema } from "@/lib/validations/job";
import {
  getJobByJobId,
  updateJob,
  deleteJob,
} from "@/lib/services/job.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { jobIdParamSchema } from "@/lib/validations/api-route";
import { logActivity } from "@/lib/admin/logActivity";

/** 60 reads per IP per minute */
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/** 20 mutations per IP per minute */
const mutateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * GET /api/v1/jobs/[jobId]
 * Get a single job by its jobId.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(readLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { jobId } = jobIdParamSchema.parse(await params);
    const job = await getJobByJobId(jobId);
    return NextResponse.json(
      { job },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, `GET /api/v1/jobs/${(await params).jobId}`);
  }
}

/**
 * PATCH /api/v1/jobs/[jobId]
 * Admin-facing: update a job.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    // Content-Type check
    const ctBlock = checkJsonContentType(request);
    if (ctBlock) return ctBlock;

    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(mutateLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    await dbConnect();
    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { jobId } = jobIdParamSchema.parse(await params);
    const body = await request.json();
    const input = updateJobSchema.parse(body);
    if (
      input.source === "referral" &&
      (!input.referralUserName?.trim() || !input.referralPhoneNumber?.trim())
    ) {
      return NextResponse.json(
        { error: "Referral user name and phone number are required when source is referral" },
        { status: 400 },
      );
    }
    const job = await updateJob(jobId, {
      ...input,
      updatedByAdminClerkId: currentAdmin.clerkId,
      updatedByAdminId: currentAdmin._id.toString(),
    });

    if (input.source === "referral" && input.referralUserName?.trim()) {
      await Referral.findOneAndUpdate(
        { postId: job.jobId },
        {
          $set: {
            postId: job.jobId,
            referralUserName: input.referralUserName.trim(),
            referralPhoneNumber: input.referralPhoneNumber!.trim(),
            createdByAdminClerkId: currentAdmin.clerkId,
          },
        },
        { upsert: true, new: true },
      );
    } else {
      await Referral.deleteOne({ postId: job.jobId });
    }

    await logActivity({
      admin: currentAdmin,
      action: "UPDATE_JOB",
      module: "CRM",
      targetType: "Job",
      targetId: job._id as mongoose.Types.ObjectId,
      targetRefId: job.jobId,
      metadata: {
        jobId: job.jobId,
        ...(job.enquiryId ? { enquiryId: job.enquiryId.toString() } : {}),
      },
    });

    return NextResponse.json({
      message: "Job updated successfully",
      job,
    });
  } catch (error) {
    return handleApiError(error, `PATCH /api/v1/jobs/${(await params).jobId}`);
  }
}

/**
 * DELETE /api/v1/jobs/[jobId]
 * Admin-facing: delete a job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    // Rate limit
    const ipDel = getClientIp(request);
    const rateLimitBlockDel = checkRateLimit(mutateLimiter, ipDel);
    if (rateLimitBlockDel) return rateLimitBlockDel;

    await dbConnect();
    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { jobId } = jobIdParamSchema.parse(await params);
    await deleteJob(jobId);
    await Referral.deleteOne({ postId: jobId });

    await logActivity({
      admin: currentAdmin,
      action: "DELETE_JOB",
      module: "CRM",
      targetType: "Job",
      targetId: new mongoose.Types.ObjectId(jobId),
      targetRefId: jobId,
      metadata: { jobId },
    });

    return NextResponse.json({ message: "Job deleted successfully" });
  } catch (error) {
    return handleApiError(error, `DELETE /api/v1/jobs/${(await params).jobId}`);
  }
}
