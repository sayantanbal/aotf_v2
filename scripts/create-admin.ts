/**
 * Admin Creation Script
 * Creates or updates a super admin account in Clerk and MongoDB.
 *
 * Usage:
 *   pnpm create:admin -- --username admin1 --password "StrongPass123!" --email admin1@aotf.local
 *   pnpm create:admin -- admin1 "StrongPass123!"
 *
 * Optional flags:
 *   --name "Admin Name"
 *   --role super_admin|admin|support_admin|crm
 *   --email admin1@aotf.local
 *   --username admin1
 *   --password "StrongPass123!"
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

type CliArgs = {
  username?: string;
  password?: string;
  email?: string;
  name?: string;
  role?: string;
};

type AdminRole = "super_admin" | "admin" | "support_admin" | "crm";

type AdminPermissions = {
  canManageUsers: boolean;
  canBlockUsers: boolean;
  canManagePosts: boolean;
  canManageJobs: boolean;
  canCreateTuitionPosts: boolean;
  canCreateJobPosts: boolean;
  canEditPosts: boolean;
  canDeletePosts: boolean;
  canHandleEnquiries: boolean;
  canHandleFeedbacks: boolean;
  canUpdateEnquiryStatus: boolean;
  canCallApplicants: boolean;
  canProcessRefunds: boolean;
  canViewPayments: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
  canManageAdmins: boolean;
  canCreateAdmins: boolean;
  canEditAdmins: boolean;
  canDeactivateAdmins: boolean;
  canResetAdminPasswords: boolean;
  canTerminateAdmins: boolean;
  canViewAuditLogs: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--username" && argv[index + 1]) {
      args.username = argv[++index];
      continue;
    }

    if (value.startsWith("--username=")) {
      args.username = value.slice("--username=".length);
      continue;
    }

    if (value === "--password" && argv[index + 1]) {
      args.password = argv[++index];
      continue;
    }

    if (value.startsWith("--password=")) {
      args.password = value.slice("--password=".length);
      continue;
    }

    if (value === "--email" && argv[index + 1]) {
      args.email = argv[++index];
      continue;
    }

    if (value.startsWith("--email=")) {
      args.email = value.slice("--email=".length);
      continue;
    }

    if (value === "--name" && argv[index + 1]) {
      args.name = argv[++index];
      continue;
    }

    if (value.startsWith("--name=")) {
      args.name = value.slice("--name=".length);
      continue;
    }

    if (value === "--role" && argv[index + 1]) {
      args.role = argv[++index];
      continue;
    }

    if (value.startsWith("--role=")) {
      args.role = value.slice("--role=".length);
      continue;
    }

    if (value.startsWith("--")) {
      continue;
    }

    positional.push(value);
  }

  if (!args.username && positional[0]) {
    args.username = positional[0];
  }

  if (!args.password && positional[1]) {
    args.password = positional[1];
  }

  return args;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function buildEmail(username: string) {
  const domain = process.env.ADMIN_EMAIL_DOMAIN || "example.com";
  return `${normalizeUsername(username)}@${domain}`;
}

function resolveClerkEmail(username: string, email?: string) {
  if (!email) {
    return buildEmail(username);
  }

  const normalized = email.trim().toLowerCase();

  if (normalized.endsWith(".local")) {
    return buildEmail(username);
  }

  return normalized;
}

function buildName(username: string) {
  return (
    username
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase()) || username
  );
}

const ROLE_PRESETS: Record<AdminRole, { role: string; aotfRole: string; permissions: AdminPermissions }> = {
  super_admin: {
    role: "super_admin",
    aotfRole: "SUPER_ADMIN",
    permissions: {
      canManageUsers: true,
      canBlockUsers: true,
      canManagePosts: true,
      canManageJobs: true,
      canCreateTuitionPosts: true,
      canCreateJobPosts: true,
      canEditPosts: true,
      canDeletePosts: true,
      canHandleEnquiries: true,
      canHandleFeedbacks: true,
      canUpdateEnquiryStatus: true,
      canCallApplicants: true,
      canProcessRefunds: true,
      canViewPayments: true,
      canViewAnalytics: true,
      canExportData: true,
      canManageAdmins: true,
      canCreateAdmins: true,
      canEditAdmins: true,
      canDeactivateAdmins: true,
      canResetAdminPasswords: true,
      canTerminateAdmins: true,
      canViewAuditLogs: true,
    },
  },
  admin: {
    role: "admin",
    aotfRole: "ADMIN",
    permissions: {
      canManageUsers: false,
      canBlockUsers: false,
      canManagePosts: true,
      canManageJobs: true,
      canCreateTuitionPosts: true,
      canCreateJobPosts: true,
      canEditPosts: true,
      canDeletePosts: true,
      canHandleEnquiries: true,
      canHandleFeedbacks: true,
      canUpdateEnquiryStatus: true,
      canCallApplicants: true,
      canProcessRefunds: false,
      canViewPayments: true,
      canViewAnalytics: false,
      canExportData: false,
      canManageAdmins: true,
      canCreateAdmins: false,
      canEditAdmins: true,
      canDeactivateAdmins: true,
      canResetAdminPasswords: false,
      canTerminateAdmins: false,
      canViewAuditLogs: true,
    },
  },
  support_admin: {
    role: "support_admin",
    aotfRole: "SUPPORT_ADMIN",
    permissions: {
      canManageUsers: false,
      canBlockUsers: false,
      canManagePosts: false,
      canManageJobs: false,
      canCreateTuitionPosts: false,
      canCreateJobPosts: false,
      canEditPosts: false,
      canDeletePosts: false,
      canHandleEnquiries: true,
      canHandleFeedbacks: true,
      canUpdateEnquiryStatus: true,
      canCallApplicants: true,
      canProcessRefunds: false,
      canViewPayments: false,
      canViewAnalytics: false,
      canExportData: false,
      canManageAdmins: false,
      canCreateAdmins: false,
      canEditAdmins: false,
      canDeactivateAdmins: false,
      canResetAdminPasswords: false,
      canTerminateAdmins: false,
      canViewAuditLogs: false,
    },
  },
  crm: {
    role: "crm",
    aotfRole: "CRM",
    permissions: {
      canManageUsers: false,
      canBlockUsers: false,
      canManagePosts: true,
      canManageJobs: true,
      canCreateTuitionPosts: true,
      canCreateJobPosts: true,
      canEditPosts: true,
      canDeletePosts: true,
      canHandleEnquiries: true,
      canHandleFeedbacks: true,
      canUpdateEnquiryStatus: true,
      canCallApplicants: false,
      canProcessRefunds: false,
      canViewPayments: false,
      canViewAnalytics: false,
      canExportData: false,
      canManageAdmins: false,
      canCreateAdmins: false,
      canEditAdmins: false,
      canDeactivateAdmins: false,
      canResetAdminPasswords: false,
      canTerminateAdmins: false,
      canViewAuditLogs: false,
    },
  },
};

function resolveAdminRole(role?: string) {
  const normalized = (role ?? "super_admin").trim().toLowerCase();

  if (normalized in ROLE_PRESETS) {
    return normalized as AdminRole;
  }

  throw new Error(
    `Invalid role "${role}". Expected one of: super_admin, admin, support_admin, crm.`,
  );
}

function buildPublicMetadata(role: AdminRole) {
  const roleMetadata = ROLE_PRESETS[role];

  return {
    role: roleMetadata.role,
    isAdmin: true,
    aotfRole: roleMetadata.aotfRole,
    ...roleMetadata.permissions,
    permissions: roleMetadata.permissions,
    requirePasswordChange: false,
  };
}

async function getClerkClient() {
  const { clerkClient } = await import("@clerk/nextjs/server");
  return clerkClient();
}

function getSecretKey() {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required");
  }

  return secretKey;
}

async function getClerkUserByEmail(email: string) {
  const client = await getClerkClient();
  const response = await client.users.getUserList({ emailAddress: [email] });
  return response.data[0] ?? null;
}

async function getClerkUserByUsername(username: string) {
  const client = await getClerkClient();
  const response = await client.users.getUserList({ username: [username] });
  return response.data[0] ?? null;
}

async function createClerkUser(params: {
  username: string;
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}) {
  const [firstName, ...rest] = params.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName || params.username;

  try {
    const client = await getClerkClient();
    return await client.users.createUser({
      username: params.username,
      emailAddress: [params.email],
      password: params.password,
      firstName: firstName || params.username,
      lastName,
      skipPasswordRequirement: false,
      skipPasswordChecks: false,
      legal_accepted_at: new Date().toISOString(),
      publicMetadata: buildPublicMetadata(params.role),
    });
  } catch (error: unknown) {
    const err = error as { errors?: Array<{ code?: string }> };
    if (err?.errors?.[0]?.code === "form_identifier_exists") {
      return null;
    }
    throw error;
  }
}

async function updateClerkUser(params: {
  clerkId: string;
  username: string;
  password: string;
  name: string;
  role: AdminRole;
}) {
  const [firstName, ...rest] = params.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName || params.username;

  const client = await getClerkClient();
  await client.users.updateUser(params.clerkId, {
    username: params.username,
    password: params.password,
    legal_accepted_at: new Date().toISOString(),
    firstName: firstName || params.username,
    lastName,
    skipPasswordChecks: false,
  });

  await client.users.updateUserMetadata(params.clerkId, {
    publicMetadata: buildPublicMetadata(params.role),
  });

  return { clerkId: params.clerkId };
}

async function deleteClerkUser(clerkId: string) {
  const client = await getClerkClient();
  await client.users.deleteUser(clerkId);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const username = args.username ? normalizeUsername(args.username) : "";
  const password = args.password ?? "";
  const email = username ? resolveClerkEmail(username, args.email) : "";
  const name = args.name || (username ? buildName(username) : "");
  const role = resolveAdminRole(args.role);

  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required");
  }

  getSecretKey();

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (!username || !password) {
    console.log(
      'Usage: pnpm create:admin -- --username admin1 --password "StrongPass123!" [--email admin1@aotf.local] [--name "Admin One"]',
    );
    throw new Error("username and password are required");
  }

  if (args.role) {
    console.log(`Creating admin with role: ${role}`);
  }

  if (args.email && args.email.trim().toLowerCase() !== email) {
    console.log(
      `Using ${email} for Clerk because ${args.email} is not accepted by Clerk.`,
    );
  }

  const { default: dbConnect } = await import("../lib/db.js");
  const { default: Admin } = await import("../lib/models/Admin.js");
  const mongoose = await import("mongoose");

  await dbConnect();

  const publicMetadata = buildPublicMetadata(role);

  let clerkId = "";
  let clerkEmail = email;
  let createdNewClerkUser = false;

  try {
    const existingByUsername = await getClerkUserByUsername(username);

    if (existingByUsername) {
      clerkId = existingByUsername.id;
      clerkEmail = existingByUsername.emailAddresses[0]?.emailAddress ?? email;
      console.log(
        `Reusing existing Clerk user ${clerkId} for username ${username} (${clerkEmail})`,
      );
      await updateClerkUser({ clerkId, username, password, name, role });
    } else {
      const existingByEmail = await getClerkUserByEmail(email);

      if (existingByEmail) {
        clerkId = existingByEmail.id;
        clerkEmail = existingByEmail.emailAddresses[0]?.emailAddress ?? email;
        console.log(`Updating existing Clerk user ${clerkId} for ${clerkEmail}`);
        await updateClerkUser({ clerkId, username, password, name, role });
      } else {
        const created = await createClerkUser({ username, email, password, name, role });

        if (!created) {
          throw new Error(
            `Clerk user already exists, but could not be resolved for username ${username} or email ${email}`,
          );
        }

        clerkId = created.id;
        clerkEmail = created.emailAddresses[0]?.emailAddress ?? email;
        createdNewClerkUser = true;
        const client = await getClerkClient();
        await client.users.updateUserMetadata(clerkId, {
          publicMetadata,
        });
      }
    }

    const permissions = ROLE_PRESETS[role].permissions;

    await Admin.findOneAndUpdate(
      { $or: [{ clerkId }, { username }, { email }] },
      {
        $set: {
          clerkId,
          username,
          email: clerkEmail,
          name,
          role,
          permissions,
          isActive: true,
          isLocked: false,
          requirePasswordChange: false,
        },
        $setOnInsert: {
          createdBy: null,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    console.log("Admin created successfully.");
    console.log(`Clerk ID : ${clerkId}`);
    console.log(`Username : ${username}`);
    console.log(`Email    : ${clerkEmail}`);
    console.log(`Name     : ${name}`);
    console.log("Public metadata:", JSON.stringify(publicMetadata, null, 2));
  } catch (error) {
    if (createdNewClerkUser && clerkId) {
      await deleteClerkUser(clerkId).catch(() => {});
    }

    console.error("Failed to create admin:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.default.connection.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});