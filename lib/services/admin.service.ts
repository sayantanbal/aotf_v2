import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import AuditLog, { type IAuditLog } from "@/lib/models/AuditLog";
import LoginAttempt from "@/lib/models/LoginAttempt";
import * as clerkService from "./clerk.service";
import * as emailService from "./email.service";

import mongoose from "mongoose";
import AdminRole from "@/lib/models/admin/AdminRole";
import { ADMIN_PERMISSION_KEYS } from "@/lib/admin/admin-permissions";

/**
 * Generate a secure random password
 */
function generateSecurePassword(length: number = 16): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
}

/**
 * Log admin action to audit log
 */
async function logAction(params: {
  adminId: string;
  adminClerkId: string;
  adminUsername: string;
  action: IAuditLog["action"];
  targetType?: IAuditLog["targetType"];
  targetId?: string;
  targetIdentifier?: string;
  details?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await AuditLog.create(params);
  } catch (error) {
    console.error("[admin-service] Error logging action:", error);
  }
}

/**
 * Create a new admin user
 */
export async function createAdmin(params: {
  username: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  creatorAdminId: string;
  creatorClerkId: string;
  creatorUsername: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    username,
    email,
    firstName,
    lastName,
    role,
    creatorAdminId,
    creatorClerkId,
    creatorUsername,
    ipAddress,
    userAgent,
  } = params;

  await dbConnect();

  // Check if username or email already exists
  const existing = await Admin.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
  });

  if (existing) {
    return {
      success: false,
      error: "Username or email already exists",
    };
  }

  // Generate temporary password
  const temporaryPassword = generateSecurePassword();

  // Create user in Clerk
  const clerkResult = await clerkService.createAdminUser({
    username,
    email,
    firstName,
    lastName,
    password: temporaryPassword,
    role,
  });

  if (!clerkResult.success) {
    return {
      success: false,
      error: clerkResult.error,
    };
  }

  // Create admin in database
  const normalizedRole = role.trim().toLowerCase();
  const roleDoc = await AdminRole.findOne({ name: normalizedRole }).lean();
  const isSystemRole = ["super_admin", "admin", "support_admin"].includes(
    normalizedRole,
  );
  const rolePermissions = roleDoc?.permissions ?? [];
  const permissions = isSystemRole
    ? Admin.getDefaultPermissions(normalizedRole)
    : ADMIN_PERMISSION_KEYS.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = rolePermissions.includes(key);
        return acc;
      }, {});
  const name = `${firstName} ${lastName || ""}`.trim();

  const admin = await Admin.create({
    clerkId: clerkResult.clerkId,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    name,
    role,
    permissions,
    isActive: true,
    requirePasswordChange: true,
    createdBy: new mongoose.Types.ObjectId(creatorAdminId),
  });

  // Sync initial permissions and metadata to Clerk
  try {
    await clerkService.updateAdminMetadata({
      clerkId: admin.clerkId,
      role: admin.role,
      isAdmin: true,
      requirePasswordChange: true,
      permissions: admin.permissions,
    });
  } catch (err) {
    console.error("[createAdmin] Failed to sync admin metadata to Clerk:", err);
  }

  // Log action
  await logAction({
    adminId: creatorAdminId,
    adminClerkId: creatorClerkId,
    adminUsername: creatorUsername,
    action: "admin.created",
    targetType: "Admin",
    targetId: admin._id.toString(),
    targetIdentifier: username,
    details: {
      role,
      email,
      name,
    },
    ipAddress,
    userAgent,
  });

  // Send creation email
  await emailService.sendAdminCreationEmail({
    email,
    name,
    username,
    temporaryPassword,
    role,
  });

  return {
    success: true,
    admin: {
      _id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
    },
  };
}

/**
 * Get all admins (with filtering)
 */
export async function getAdmins(params?: {
  role?: string;
  isActive?: boolean;
  isLocked?: boolean;
  includeTerminated?: boolean;
}) {
  await dbConnect();

  const query: Record<string, unknown> = {};

  if (params?.role) {
    query.role = params.role;
  }

  if (params?.isActive !== undefined) {
    query.isActive = params.isActive;
  }

  if (params?.isLocked !== undefined) {
    query.isLocked = params.isLocked;
  }

  // Exclude terminated admins by default
  if (!params?.includeTerminated) {
    query.terminatedAt = null;
  }

  const admins = await Admin.find(query)
    .select("-__v")
    .populate("createdBy", "username name")
    .sort({ createdAt: -1 })
    .lean();

  return {
    success: true,
    admins,
  };
}

/**
 * Get admin by ID
 */
export async function getAdminById(adminId: string) {
  await dbConnect();

  const admin = await Admin.findById(adminId)
    .select("-__v")
    .populate("createdBy", "username name")
    .populate("terminatedBy", "username name")
    .lean();

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  return {
    success: true,
    admin,
  };
}

/**
 * Update admin permissions
 */
export async function updateAdminPermissions(params: {
  adminId: string;
  permissions: Record<string, boolean>;
  updaterAdminId: string;
  updaterClerkId: string;
  updaterUsername: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    adminId,
    permissions,
    updaterAdminId,
    updaterClerkId,
    updaterUsername,
    ipAddress,
    userAgent,
  } = params;

  await dbConnect();

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  const oldPermissions = { ...admin.permissions };

  admin.permissions = { ...admin.permissions, ...permissions };
  await admin.save();

  // Sync updated permissions to Clerk
  try {
    await clerkService.updateAdminMetadata({
      clerkId: admin.clerkId,
      role: admin.role,
      isAdmin: true,
      permissions: admin.permissions,
    });
  } catch (err) {
    console.error(
      "[updateAdminPermissions] Failed to sync permissions to Clerk:",
      err,
    );
  }

  // Log action
  await logAction({
    adminId: updaterAdminId,
    adminClerkId: updaterClerkId,
    adminUsername: updaterUsername,
    action: "admin.permissions_updated",
    targetType: "Admin",
    targetId: adminId,
    targetIdentifier: admin.username,
    changes: {
      before: oldPermissions,
      after: admin.permissions,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    admin,
  };
}

/**
 * Deactivate or reactivate admin
 */
export async function toggleAdminStatus(params: {
  adminId: string;
  isActive: boolean;
  updaterAdminId: string;
  updaterClerkId: string;
  updaterUsername: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    adminId,
    isActive,
    updaterAdminId,
    updaterClerkId,
    updaterUsername,
    ipAddress,
    userAgent,
  } = params;

  await dbConnect();

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  admin.isActive = isActive;
  await admin.save();

  // When deactivating, ban the Clerk user; when reactivating, unban.
  try {
    await clerkService.setAdminLockStatus(admin.clerkId, !isActive);
  } catch (err) {
    console.error(
      "[toggleAdminStatus] Failed to update Clerk for admin status change:",
      err,
    );
  }

  // Log action
  await logAction({
    adminId: updaterAdminId,
    adminClerkId: updaterClerkId,
    adminUsername: updaterUsername,
    action: isActive ? "admin.reactivated" : "admin.deactivated",
    targetType: "Admin",
    targetId: adminId,
    targetIdentifier: admin.username,
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    admin,
  };
}

/**
 * Terminate admin (soft delete)
 */
export async function terminateAdmin(params: {
  adminId: string;
  terminatorAdminId: string;
  terminatorClerkId: string;
  terminatorUsername: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    adminId,
    terminatorAdminId,
    terminatorClerkId,
    terminatorUsername,
    ipAddress,
    userAgent,
  } = params;

  await dbConnect();

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  if (admin.terminatedAt) {
    return {
      success: false,
      error: "Admin is already terminated",
    };
  }

  admin.isActive = false;
  admin.terminatedBy = new mongoose.Types.ObjectId(terminatorAdminId);
  admin.terminatedAt = new Date();
  await admin.save();

  // Hard-delete the admin from Clerk so they cannot log back in.
  // Fall back to ban if delete fails (e.g. clerkId mismatch).
  try {
    const deleteResult = await clerkService.deleteAdminUser(admin.clerkId);
    if (!deleteResult.success) {
      // Ban as fallback — prevents sign-in without deleting the Clerk record
      await clerkService.setAdminLockStatus(admin.clerkId, true);
      console.warn(
        `[terminateAdmin] Clerk delete failed for ${admin.username}, fell back to ban`,
      );
    }
  } catch (err) {
    console.error("[terminateAdmin] Failed to remove admin from Clerk:", err);
  }

  // Log action
  await logAction({
    adminId: terminatorAdminId,
    adminClerkId: terminatorClerkId,
    adminUsername: terminatorUsername,
    action: "admin.terminated",
    targetType: "Admin",
    targetId: adminId,
    targetIdentifier: admin.username,
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    admin: {
      id: admin._id.toString(),
      username: admin.username,
      name: admin.name,
      terminatedAt: admin.terminatedAt,
    },
  };
}

/**
 * Reset admin password (send reset link)
 */
export async function resetAdminPassword(params: {
  adminId: string;
  resetterAdminUsername: string;
  resetterAdminId: string;
  resetterClerkId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    adminId,
    resetterAdminUsername,
    resetterAdminId,
    resetterClerkId,
    ipAddress,
    userAgent,
  } = params;

  await dbConnect();

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  // Set requirePasswordChange flag
  admin.requirePasswordChange = true;
  await admin.save();

  // Update Clerk metadata
  await clerkService.updateAdminMetadata({
    clerkId: admin.clerkId,
    role: admin.role,
    isAdmin: true,
    requirePasswordChange: true,
  });

  // Send password reset notification
  await emailService.sendPasswordResetNotification({
    email: admin.email,
    name: admin.name,
    resetByAdmin: resetterAdminUsername,
  });

  // Log action
  await logAction({
    adminId: resetterAdminId,
    adminClerkId: resetterClerkId,
    adminUsername: resetterAdminUsername,
    action: "admin.password_reset",
    targetType: "Admin",
    targetId: adminId,
    targetIdentifier: admin.username,
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Password reset initiated",
  };
}

/**
 * Unlock admin account
 */
export async function unlockAdmin(params: {
  adminId: string;
  unlockerAdminId: string;
  unlockerClerkId: string;
  unlockerUsername: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    adminId,
    unlockerAdminId,
    unlockerClerkId,
    unlockerUsername,
    ipAddress,
    userAgent,
  } = params;

  await dbConnect();

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  admin.isLocked = false;
  admin.lockedAt = null;
  admin.failedLoginAttempts = 0;
  admin.lastFailedLoginAt = null;
  admin.requirePasswordChange = true; // Force password change after unlock
  await admin.save();

  // Update Clerk
  await clerkService.setAdminLockStatus(admin.clerkId, false);
  await clerkService.updateAdminMetadata({
    clerkId: admin.clerkId,
    role: admin.role,
    isAdmin: true,
    isLocked: false,
    requirePasswordChange: true,
  });

  // Send unlock email
  await emailService.sendAccountUnlockedEmail({
    email: admin.email,
    name: admin.name,
    unlockedBy: unlockerUsername,
  });

  // Log action
  await logAction({
    adminId: unlockerAdminId,
    adminClerkId: unlockerClerkId,
    adminUsername: unlockerUsername,
    action: "admin.unlocked",
    targetType: "Admin",
    targetId: adminId,
    targetIdentifier: admin.username,
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    admin,
  };
}

/**
 * Record failed login attempt and lock if threshold reached
 */
export async function recordFailedLoginAttempt(params: {
  username: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
}) {
  const { username, email, ipAddress, userAgent, failureReason } = params;

  await dbConnect();

  const admin = await Admin.findOne({ username: username.toLowerCase() });

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  // Record login attempt
  await LoginAttempt.create({
    clerkId: admin.clerkId,
    email: admin.email,
    username: admin.username,
    success: false,
    ipAddress,
    userAgent,
    failureReason,
  });

  // Increment failed attempts
  admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
  admin.lastFailedLoginAt = new Date();

  // Lock account if 5 or more failed attempts
  if (admin.failedLoginAttempts >= 5 && !admin.isLocked) {
    admin.isLocked = true;
    admin.lockedAt = new Date();
    await admin.save();

    // Update Clerk
    await clerkService.setAdminLockStatus(admin.clerkId, true);

    // Send locked email
    await emailService.sendAccountLockedEmail({
      email: admin.email,
      name: admin.name,
      reason: "failed_attempts",
    });

    return {
      success: true,
      locked: true,
      attempts: admin.failedLoginAttempts,
    };
  }

  await admin.save();

  return {
    success: true,
    locked: false,
    attempts: admin.failedLoginAttempts,
  };
}

/**
 * Record successful login (reset failed attempts)
 */
export async function recordSuccessfulLogin(params: {
  clerkId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { clerkId, ipAddress, userAgent } = params;

  await dbConnect();

  const admin = await Admin.findOne({ clerkId });

  if (!admin) {
    return {
      success: false,
      error: "Admin not found",
    };
  }

  // Record login attempt
  await LoginAttempt.create({
    clerkId: admin.clerkId,
    email: admin.email,
    username: admin.username,
    success: true,
    ipAddress,
    userAgent,
  });

  // Reset failed attempts
  if (admin.failedLoginAttempts > 0) {
    admin.failedLoginAttempts = 0;
    admin.lastFailedLoginAt = null;
    await admin.save();
  }

  return {
    success: true,
  };
}

/**
 * Get audit logs
 */
export async function getAuditLogs(params?: {
  adminId?: string;
  action?: string;
  targetType?: string;
  limit?: number;
  skip?: number;
}) {
  await dbConnect();

  const query: Record<string, unknown> = {};

  if (params?.adminId) {
    query.adminId = params.adminId;
  }

  if (params?.action) {
    query.action = params.action;
  }

  if (params?.targetType) {
    query.targetType = params.targetType;
  }

  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(params?.limit || 100)
    .skip(params?.skip || 0)
    .populate("adminId", "username name")
    .lean();

  const total = await AuditLog.countDocuments(query);

  return {
    success: true,
    logs,
    total,
  };
}
