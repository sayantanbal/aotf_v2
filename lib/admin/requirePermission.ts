import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AdminRole from "@/lib/models/admin/AdminRole";
import AdminUser from "@/lib/models/admin/AdminUser";
import Admin from "@/lib/models/Admin";
import type { Permission } from "@/lib/admin/permissions";
import type { IAdminUser } from "@/lib/models/admin/AdminUser";

type PermissionResult = {
  admin: IAdminUser | null;
  error?: NextResponse;
};

export function requirePermission(...required: Permission[]) {
  return async function permissionGuard(
    _req: Request,
  ): Promise<PermissionResult> {
    await dbConnect();
    const { userId } = await auth();

    if (!userId) {
      return {
        admin: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    if (required.includes("whatsapp:manage")) {
      const legacyAdmin = await Admin.findOne({ clerkId: userId });
      let metadata = {} as Record<string, unknown>;
      try {
        const claims = (await auth()).sessionClaims;
        metadata = (claims?.publicMetadata ?? {}) as Record<string, unknown>;
        if (metadata.isAdmin !== true) {
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          metadata = clerkUser.publicMetadata as Record<string, unknown>;
        }
      } catch {
        // The database permission check below remains authoritative.
      }

      const hasPermission =
        legacyAdmin?.isActive === true &&
        (legacyAdmin.role === "super_admin" ||
          legacyAdmin.permissions.canManageWhatsAppGroups === true ||
          metadata.canManageWhatsAppGroups === true ||
          (metadata.permissions as Record<string, unknown> | undefined)
            ?.canManageWhatsAppGroups === true);

      if (hasPermission) return { admin: null };
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        ),
      };
    }

    const admin = await AdminUser.findOne({ clerkUserId: userId });
    if (!admin || admin.status !== "ACTIVE") {
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Forbidden: admin not active" },
          { status: 403 },
        ),
      };
    }

    if (required.length === 0) {
      return { admin };
    }

    const role = await AdminRole.findOne({ name: admin.role }).lean();
    const rolePermissions = role?.permissions ?? [];
    const hasAll = required.every((perm) => rolePermissions.includes(perm));

    if (!hasAll) {
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Insufficient permissions", required },
          { status: 403 },
        ),
      };
    }

    return { admin };
  };
}

export async function getAdminFromRequest(_req: Request) {
  await dbConnect();
  const { userId } = await auth();
  if (!userId) return null;
  return await AdminUser.findOne({ clerkUserId: userId });
}
