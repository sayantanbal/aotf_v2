import { handleApiError } from "@/lib/api-utils";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import * as adminService from "@/lib/services/admin.service";
import Admin from "@/lib/models/Admin";
import dbConnect from "@/lib/db";

/**
 * POST /api/v1/admin/admins/[id]/terminate - Terminate admin (soft delete)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const currentAdmin = await Admin.findOne({ clerkId: userId });

    if (!currentAdmin || !currentAdmin.isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only super_admin or permissioned admins can terminate admins
    if (
      currentAdmin.role !== "super_admin" &&
      !currentAdmin.permissions.canTerminateAdmins
    ) {
      return NextResponse.json(
        { error: "Only superadmin can terminate admins" },
        { status: 403 },
      );
    }

    const targetAdmin = await Admin.findById(id);

    if (!targetAdmin) {
      return NextResponse.json(
        { error: "Target admin not found" },
        { status: 404 },
      );
    }

    // Cannot terminate self
    if (currentAdmin._id.toString() === id) {
      return NextResponse.json(
        { error: "You cannot terminate yourself" },
        { status: 400 },
      );
    }

    const result = await adminService.terminateAdmin({
      adminId: id,
      terminatorAdminId: currentAdmin._id.toString(),
      terminatorClerkId: currentAdmin.clerkId,
      terminatorUsername: currentAdmin.username,
      ipAddress:
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "POST /api/v1/admin/admins/[id]/terminate");
  }
}
