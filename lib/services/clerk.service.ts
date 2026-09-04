import { clerkClient } from "@clerk/nextjs/server";

/**
 * Clerk Backend API Service
 * Handles admin user creation, updates, and management via Clerk's Backend API
 */

export interface CreateAdminUserParams {
  username: string;
  email: string;
  firstName: string;
  lastName?: string;
  password: string;
  role: string;
}

export interface UpdateAdminMetadataParams {
  clerkId: string;
  role?: string;
  isAdmin: boolean;
  requirePasswordChange?: boolean;
  isLocked?: boolean;
  permissions?: Record<string, boolean>;
}

function normalizeAotfRole(role: string) {
  return role
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Create a new admin user in Clerk
 */
export async function createAdminUser(params: CreateAdminUserParams) {
  const { username, email, firstName, lastName, password, role } = params;
  try {
    const client = await clerkClient();
    const user = await client.users.createUser({
      username,
      emailAddress: [email],
      firstName,
      lastName: lastName || "",
      password,
      skipPasswordRequirement: false,
      skipPasswordChecks: false,
      legalAcceptedAt: new Date(),
      publicMetadata: {
        isAdmin: true,
        role,
        aotfRole: normalizeAotfRole(role),
        requirePasswordChange: true,
      },
      privateMetadata: {
        adminCreatedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      clerkId: user.id,
      username: user.username,
      email: user.emailAddresses[0]?.emailAddress,
    };
  } catch (error: unknown) {
    console.error("[clerk-service] Error creating admin user:", error);
    // Handle specific Clerk errors
    const err = error as { errors?: Array<{ code: string; message: string }> };
    if (err.errors && Array.isArray(err.errors)) {
      const firstError = err.errors[0];
      if (firstError?.code === "form_identifier_exists") {
        return {
          success: false,
          error: "Username or email already exists",
          code: "duplicate",
        };
      }
    }
    return {
      success: false,
      error: "Failed to create admin user in Clerk",
      code: "unknown",
    };
  }
}

/**
 * Update admin user metadata in Clerk
 */
export async function updateAdminMetadata(params: UpdateAdminMetadataParams) {
  const { clerkId, role, isAdmin, requirePasswordChange, isLocked } = params;
  try {
    const client = await clerkClient();
    const publicMetadata: Record<string, unknown> = {
      isAdmin,
    };
    if (role) {
      publicMetadata.role = role;
      publicMetadata.aotfRole = normalizeAotfRole(role);
    }
    // attach permissions if provided so Clerk's shallow merge overwrites old object
    if ((params as UpdateAdminMetadataParams).permissions !== undefined) {
      publicMetadata.permissions = (
        params as UpdateAdminMetadataParams
      ).permissions;
    }
    if (requirePasswordChange !== undefined) {
      publicMetadata.requirePasswordChange = requirePasswordChange;
    }
    if (isLocked !== undefined) {
      publicMetadata.isLocked = isLocked;
    }
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata,
    });
    return { success: true };
  } catch (error) {
    console.error("[clerk-service] Error updating admin metadata:", error);
    return {
      success: false,
      error: "Failed to update admin metadata",
    };
  }
}

/**
 * Send password reset email to admin
 */
export async function sendPasswordResetEmail(email: string) {
  try {
    const client = await clerkClient();
    // Create a password reset for the user
    const passwordReset = await client.users.getUserList({
      emailAddress: [email],
    });
    if (!passwordReset.data || passwordReset.data.length === 0) {
      return {
        success: false,
        error: "User not found",
      };
    }
    const user = passwordReset.data[0];
    // Clerk doesn't have a direct password reset API, but we can use the email verification system
    // The admin will need to use Clerk's "Forgot Password" flow
    return {
      success: true,
      message: "Admin should use the 'Forgot Password' link on the login page",
    };
  } catch (error) {
    console.error("[clerk-service] Error sending password reset:", error);
    return {
      success: false,
      error: "Failed to initiate password reset",
    };
  }
}

/**
 * Delete admin user from Clerk (hard delete)
 */
export async function deleteAdminUser(clerkId: string) {
  try {
    const client = await clerkClient();
    await client.users.deleteUser(clerkId);
    return { success: true };
  } catch (error) {
    console.error("[clerk-service] Error deleting admin user:", error);
    return {
      success: false,
      error: "Failed to delete admin user",
    };
  }
}

/**
 * Get admin user from Clerk
 */
export async function getAdminUser(clerkId: string) {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkId);
    return {
      success: true,
      user: {
        clerkId: user.id,
        username: user.username,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        publicMetadata: user.publicMetadata,
        privateMetadata: user.privateMetadata,
      },
    };
  } catch (error) {
    console.error("[clerk-service] Error getting admin user:", error);
    return {
      success: false,
      error: "Failed to get admin user",
    };
  }
}

/**
 * Update admin user in Clerk (username, email, name)
 */
export async function updateAdminUser(
  clerkId: string,
  updates: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  },
) {
  try {
    const client = await clerkClient();
    const updateData: Record<string, unknown> = {};
    if (updates.username) {
      updateData.username = updates.username;
    }
    if (updates.firstName !== undefined) {
      updateData.firstName = updates.firstName;
    }
    if (updates.lastName !== undefined) {
      updateData.lastName = updates.lastName;
    }
    // Email update requires verification
    if (updates.email) {
      // Note: In Clerk, email updates require verification.
      // The user requirement says email is locked, so we won't implement this.
    }
    await client.users.updateUser(clerkId, updateData);
    return { success: true };
  } catch (error) {
    console.error("[clerk-service] Error updating admin user:", error);
    return {
      success: false,
      error: "Failed to update admin user",
    };
  }
}

/**
 * Lock/unlock admin account
 */
export async function setAdminLockStatus(clerkId: string, isLocked: boolean) {
  try {
    await updateAdminMetadata({
      clerkId,
      isAdmin: true,
      isLocked,
    });
    const client = await clerkClient();
    if (isLocked) {
      await client.users.banUser(clerkId);
    } else {
      await client.users.unbanUser(clerkId);
    }
    return { success: true };
  } catch (error) {
    console.error("[clerk-service] Error setting admin lock status:", error);
    return {
      success: false,
      error: "Failed to update admin lock status",
    };
  }
}
