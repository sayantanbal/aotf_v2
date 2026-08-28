import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import * as adminService from "@/lib/services/admin.service";
import Admin from "@/lib/models/Admin";
import dbConnect from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

/**
 * POST /api/v1/admin/admins/[id]/change-password
 * Updates the target admin's password in Clerk and clears the force-password-change flag.
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
          "[POST /api/v1/admin/admins/[id]/change-password] Clerk fallback failed:",
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

    const targetAdmin = await Admin.findById(id);
    if (!targetAdmin) {
      return NextResponse.json(
        { error: "Target admin not found" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    const isSelfChange =
      currentAdmin._id.toString() === targetAdmin._id.toString();

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    if (isSelfChange && currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must differ from the current password" },
        { status: 400 },
      );
    }

    if (currentAdmin.role !== "super_admin" && !isSelfChange) {
      return NextResponse.json(
        { error: "You can only change your own password" },
        { status: 403 },
      );
    }

    if (isSelfChange) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 },
        );
      }

      const client = await clerkClient();
      const user = await client.users.getUser(targetAdmin.clerkId);

      try {
        await client.users.verifyPassword({
          userId: user.id,
          password: currentPassword,
        });
      } catch {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 },
        );
      }
    }

    const result = await adminService.changeAdminPassword({
      adminId: id,
      newPassword,
      changedByAdminId: currentAdmin._id.toString(),
      changedByClerkId: currentAdmin.clerkId,
      changedByUsername: currentAdmin.username,
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
    return handleApiError(
      error,
      "POST /api/v1/admin/admins/[id]/change-password",
    );
  }
}
