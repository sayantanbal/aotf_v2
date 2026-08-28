import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import * as adminService from "@/lib/services/admin.service";
import Admin from "@/lib/models/Admin";
import dbConnect from "@/lib/db";

/**
 * POST /api/v1/admin/admins/[id]/reactivate - Reactivate admin
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

    // Check permissions
    if (
      !currentAdmin.permissions.canDeactivateAdmins &&
      currentAdmin.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "You don't have permission to reactivate admins" },
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

    // Sub-superadmins can only reactivate support admins
    if (currentAdmin.role === "admin" && targetAdmin.role !== "support_admin") {
      return NextResponse.json(
        { error: "You can only reactivate support admins" },
        { status: 403 },
      );
    }

    const result = await adminService.toggleAdminStatus({
      adminId: id,
      isActive: true,
      updaterAdminId: currentAdmin._id.toString(),
      updaterClerkId: currentAdmin.clerkId,
      updaterUsername: currentAdmin.username,
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
    return handleApiError(error, "POST /api/v1/admin/admins/[id]/reactivate");
  }
}
