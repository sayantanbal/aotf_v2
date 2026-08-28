import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import * as adminService from "@/lib/services/admin.service";
import Admin from "@/lib/models/Admin";
import AdminRole from "@/lib/models/admin/AdminRole";
import dbConnect from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * POST /api/v1/admin/admins - Create new admin
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let metadata: Record<string, unknown> | undefined =
      sessionClaims?.publicMetadata as Record<string, unknown> | undefined;

    if (metadata?.isAdmin !== true) {
      // Try fetching latest user metadata from Clerk as a fallback
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId as string);
        metadata = clerkUser.publicMetadata as
          | Record<string, unknown>
          | undefined;
      } catch (err) {
        console.warn("Could not fetch Clerk user metadata fallback:", err);
      }
    }

    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    // Get current admin
    const currentAdmin = await Admin.findOne({ clerkId: userId });

    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Only super_admin can create admins.
    if (currentAdmin.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only superadmin can create admins" },
        { status: 403 },
      );
    }

    if (!currentAdmin.isActive) {
      return NextResponse.json(
        { error: "Admin account is deactivated" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { username, email, firstName, lastName, role } = body as {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    };

    // Validate input
    if (!username || !email || !firstName || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const normalizedRole = role.trim().toLowerCase();
    const roleDoc = await AdminRole.findOne({ name: normalizedRole }).lean();
    const isSystemRole = ["super_admin", "admin", "support_admin"].includes(
      normalizedRole,
    );
    if (!roleDoc && !isSystemRole) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }

    const result = await adminService.createAdmin({
      username,
      email,
      firstName,
      lastName,
      role: normalizedRole,
      creatorAdminId: currentAdmin._id.toString(),
      creatorClerkId: currentAdmin.clerkId,
      creatorUsername: currentAdmin.username,
      ipAddress:
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/v1/admin/admins");
  }
}

/**
 * GET /api/v1/admin/admins - Get all admins
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let metadata: Record<string, unknown> | undefined =
      sessionClaims?.publicMetadata as Record<string, unknown> | undefined;

    if (metadata?.isAdmin !== true) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId as string);
        metadata = clerkUser.publicMetadata as
          | Record<string, unknown>
          | undefined;
      } catch (err) {
        console.warn("Could not fetch Clerk user metadata fallback:", err);
      }
    }

    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    // Get current admin
    const currentAdmin = await Admin.findOne({ clerkId: userId });

    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Check if admin has permission to view admins
    if (
      !currentAdmin.permissions.canViewAuditLogs &&
      currentAdmin.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "You don't have permission to view admins" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || undefined;
    const isActive = searchParams.get("isActive");
    const isLocked = searchParams.get("isLocked");

    const result = await adminService.getAdmins({
      role,
      isActive: isActive ? isActive === "true" : undefined,
      isLocked: isLocked ? isLocked === "true" : undefined,
    });

    // Sub-superadmins can only see support admins
    if (currentAdmin.role === "admin") {
      result.admins = result.admins.filter(
        (admin) => admin.role === "support_admin",
      );
    }

    // Fetch avatars from Clerk
    if (result.admins && result.admins.length > 0) {
      try {
        const client = await clerkClient();
        const clerkIds = result.admins
          .map((a: any) => a.clerkId)
          .filter(Boolean);
        if (clerkIds.length > 0) {
          const clerkUsers = await client.users.getUserList({
            userId: clerkIds,
            limit: 100, // Safe limit for typical admin lists
          });
          const avatarMap = new Map<string, string>();
          const lastLoginMap = new Map<string, string>();
          clerkUsers.data.forEach((u) => {
            avatarMap.set(u.id, u.imageUrl);
            const lastLogin = toIsoString(u.lastSignInAt);
            if (lastLogin) {
              lastLoginMap.set(u.id, lastLogin);
            }
          });
          result.admins = result.admins.map((a: any) => ({
            ...a,
            avatarUrl: a.clerkId ? avatarMap.get(a.clerkId) : undefined,
            lastLogin: a.clerkId ? lastLoginMap.get(a.clerkId) : undefined,
          }));
        }
      } catch (err) {
        console.warn("[GET /api/v1/admin/admins] Error fetching avatars:", err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "GET /api/v1/admin/admins");
  }
}
