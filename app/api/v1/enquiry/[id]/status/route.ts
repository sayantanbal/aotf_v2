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
import Enquiry from "@/lib/models/Enquiry";
import { ADMIN_ROLES, type AdminRole } from "@/lib/models/EnqStatus";
import dbConnect from "@/lib/db";
import { updateStatusSchema, objectIdSchema } from "@/lib/validations/enquiry";
import {
  updateEnquiryStatus,
  getEnquiryStatusHistory,
} from "@/lib/services/enquiry.service";
import { createRateLimiter } from "@/lib/rate-limit";
import { logActivity } from "@/lib/admin/logActivity";

/** 60 reads per IP per minute */
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/** 20 mutations per IP per minute */
const mutateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/enquiry/[id]/status
 * Admin-facing: update an enquiry's status and create an audit trail record.
 *
 * Request body:
 *   { toStatus, action, notes?, adminId, adminName, adminRole }
 *
 * Success 200:
 *   { message, fromStatus, toStatus, attemptNumber }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const rateLimitBlock = checkRateLimit(mutateLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    await dbConnect();
    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { id } = await params;
    objectIdSchema.parse(id);

    const body = await request.json();
    const parsedInput = updateStatusSchema
      .omit({ adminId: true, adminName: true, adminRole: true })
      .parse(body);
    const adminRole: AdminRole = ADMIN_ROLES.includes(
      currentAdmin.role as AdminRole,
    )
      ? (currentAdmin.role as AdminRole)
      : "super_admin";
    const input = {
      ...parsedInput,
      adminId: currentAdmin._id.toString(),
      adminName: currentAdmin.name,
      adminRole,
    };

    const result = await updateEnquiryStatus(id, input);

    // Fetch the human-readable enquiryId for narrative display
    const enquiry = await Enquiry.findById(id, { enquiryId: 1 }).lean();
    const enquiryRefId = (enquiry as any)?.enquiryId ?? null;

    await logActivity({
      admin: currentAdmin,
      action: "UPDATE_ENQUIRY_STATUS",
      module: "CRM",
      targetType: "Enquiry",
      targetId: new mongoose.Types.ObjectId(id),
      targetRefId: enquiryRefId,
      metadata: {
        enquiryId: enquiryRefId,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
        action: input.action,
        notes: input.notes ?? null,
      },
    });

    return NextResponse.json({
      message: "Status updated successfully",
      ...result,
    });
  } catch (error) {
    return handleApiError(error, "PATCH /api/v1/enquiry/[id]/status");
  }
}

/**
 * GET /api/v1/enquiry/[id]/status
 * Admin-facing: retrieve the full status-change history for an enquiry.
 *
 * Success 200:
 *   { statusHistory: IEnqStatus[] }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rateLimitBlock = checkRateLimit(readLimiter, ip);
    if (rateLimitBlock) return rateLimitBlock;

    const { id } = await params;
    objectIdSchema.parse(id);

    const statusHistory = await getEnquiryStatusHistory(id);
    return NextResponse.json({ statusHistory });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/enquiry/[id]/status");
  }
}
