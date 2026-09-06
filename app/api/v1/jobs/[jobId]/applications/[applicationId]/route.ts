import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  checkCsrfOrigin,
  checkJsonContentType,
} from "@/lib/api-utils";
import {
  getApplicationById,
  updateApplicationStatus,
} from "@/lib/services/application.service";
import {
  applicationIdParamSchema,
  jobIdParamSchema,
  updateApplicationStatusBodySchema,
} from "@/lib/validations/api-route";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string; applicationId: string }> },
) {
  const resolved = await params;
  try {
    jobIdParamSchema.parse({ jobId: resolved.jobId });
    const { applicationId } = applicationIdParamSchema.parse({
      applicationId: resolved.applicationId,
    });
    const application = await getApplicationById(applicationId);
    if (!application || application.jobIdPublic !== resolved.jobId) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ application });
  } catch (error) {
    return handleApiError(
      error,
      `GET /api/v1/jobs/${resolved.jobId}/applications/${resolved.applicationId}`,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; applicationId: string }> },
) {
  const resolved = await params;
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;
    const contentTypeBlock = checkJsonContentType(request);
    if (contentTypeBlock) return contentTypeBlock;

    await dbConnect();
    const admin = await Admin.findOne({ clerkId, isActive: true }).lean<{
      _id: mongoose.Types.ObjectId;
    }>();
    if (!admin)
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );

    const { applicationId } = applicationIdParamSchema.parse({
      applicationId: resolved.applicationId,
    });
    const existing = await getApplicationById(applicationId);
    if (!existing || existing.jobIdPublic !== resolved.jobId) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const body = updateApplicationStatusBodySchema.parse(await request.json());
    const updated = await updateApplicationStatus({
      applicationId,
      status: body.status,
      adminId: admin._id,
      approvedAt: body.approvedAt ? new Date(body.approvedAt) : undefined,
      reason: body.reason,
    });

    return NextResponse.json({
      message: "Application status updated successfully",
      application: updated,
    });
  } catch (error) {
    return handleApiError(
      error,
      `PATCH /api/v1/jobs/${resolved.jobId}/applications/${resolved.applicationId}`,
    );
  }
}
