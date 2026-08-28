import { handleApiError } from "@/lib/api-utils";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import * as adminService from "@/lib/services/admin.service";
import Admin from "@/lib/models/Admin";
import dbConnect from "@/lib/db";

/**
 * GET /api/v1/admin/admins/[id] - Get admin by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let metadata = sessionClaims?.publicMetadata as
      | Record<string, unknown>
      | undefined;

    if (metadata?.isAdmin !== true) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        metadata = clerkUser.publicMetadata as
          | Record<string, unknown>
          | undefined;
      } catch (err) {
        console.warn(
          "[GET /api/v1/admin/admins/[id]] Could not fetch Clerk metadata fallback:",
          err,
        );
      }
    }

    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const currentAdmin = await Admin.findOne({ clerkId: userId });

    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const result = await adminService.getAdminById(id);

    if (!result.success || !result.admin) {
      return NextResponse.json(
        { error: result.error || "Admin not found" },
        { status: 404 },
      );
    }

    // Sub-superadmins can only view support admins
    if (
      currentAdmin.role === "admin" &&
      result.admin.role !== "support_admin"
    ) {
      return NextResponse.json(
        { error: "You can only view support admins" },
        { status: 403 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "GET /api/v1/admin/admins/[id]");
  }
}

/**
 * PATCH /api/v1/admin/admins/[id] - Update admin permissions
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let metadata = sessionClaims?.publicMetadata as
      | Record<string, unknown>
      | undefined;

    if (metadata?.isAdmin !== true) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        metadata = clerkUser.publicMetadata as
          | Record<string, unknown>
          | undefined;
      } catch (err) {
        console.warn(
          "[PATCH /api/v1/admin/admins/[id]] Could not fetch Clerk metadata fallback:",
          err,
        );
      }
    }

    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const currentAdmin = await Admin.findOne({ clerkId: userId });

    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Check permissions
    if (
      !currentAdmin.permissions.canEditAdmins &&
      currentAdmin.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "You don't have permission to edit admins" },
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

    // Sub-superadmins can only edit support admins
    if (currentAdmin.role === "admin" && targetAdmin.role !== "support_admin") {
      return NextResponse.json(
        { error: "You can only edit support admins" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { permissions } = body;

    if (!permissions) {
      return NextResponse.json(
        { error: "Missing permissions" },
        { status: 400 },
      );
    }

    const result = await adminService.updateAdminPermissions({
      adminId: id,
      permissions,
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
    return handleApiError(error, "PATCH /api/v1/admin/admins/[id]");
  }
}
