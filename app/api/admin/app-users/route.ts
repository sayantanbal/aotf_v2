import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import Profile from "@/lib/models/Profile";
import User from "@/lib/models/User";
import { isClerkAdmin } from "@/lib/migration/clerk-user-filters";
import { syncClerkAppUsers } from "@/lib/migration/sync-clerk-app-users";
import {
  createAppUser,
  type AdminCreateAppUserRole,
} from "@/lib/services/app-user.service";

type UserFilter = {
  role?: string;
  status?: string;
  search?: string;
  page?: string;
  limit?: string;
  bundle?: string;
  sync?: string;
};

type LeanUser = {
  _id: unknown;
  clerkId: string;
  username: string;
  role: string;
  status: string;
  onboardingCompleted: boolean;
  plan: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const PAGE_SIZE = 10;

type AppUserDbRole = "teacher" | "teacher_candidate";

const roleMap: Record<string, AppUserDbRole> = {
  candidate: "teacher_candidate",
  teacher: "teacher",
};

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDbRole(role: string): AppUserDbRole {
  return roleMap[role] ?? (role as AppUserDbRole);
}

async function requireManageUsersAdmin(userId: string) {
  const { sessionClaims } = await auth();
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
    } catch {
      // Fall through to DB admin lookup.
    }
  }

  if (metadata?.isAdmin !== true) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const currentAdmin = await Admin.findOne({ clerkId: userId });
  if (!currentAdmin || !currentAdmin.isActive) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: admin not active" },
        { status: 403 },
      ),
    };
  }

  if (
    currentAdmin.role !== "super_admin" &&
    !currentAdmin.permissions.canManageUsers
  ) {
    return {
      error: NextResponse.json(
        { error: "You don't have permission to manage users" },
        { status: 403 },
      ),
    };
  }

  return { admin: currentAdmin };
}

async function getAdminClerkIds() {
  return new Set((await Admin.find({}).distinct("clerkId")).map(String));
}

function buildStatusQuery(status?: string) {
  const query: Record<string, unknown> = {};
  if (status && status !== "all") {
    query.status = status;
  }
  return query;
}

function buildAggregationPipeline(
  statusQuery: Record<string, unknown>,
  adminClerkIds: Set<string>,
  search: string,
  baseMatch: Record<string, unknown> = {},
) {
  const pipeline: any[] = [
    {
      $match: {
        ...statusQuery,
        ...baseMatch,
        clerkId: { $nin: Array.from(adminClerkIds) },
      },
    },
  ];

  if (search) {
    const searchRegex = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    pipeline.push({
      $lookup: {
        from: "profiles",
        localField: "clerkId",
        foreignField: "clerkId",
        as: "profile",
      },
    });
    pipeline.push({
      $unwind: { path: "$profile", preserveNullAndEmptyArrays: true },
    });
    pipeline.push({
      $match: {
        $or: [
          { username: searchRegex },
          { "profile.displayName": searchRegex },
          { "profile.phone": searchRegex },
          { "profile.whatsapp": searchRegex },
        ],
      },
    });
  }

  return pipeline;
}

async function fetchRolePage(
  friendlyRole: "teacher" | "candidate",
  page: number,
  statusQuery: Record<string, unknown>,
  adminClerkIds: Set<string>,
  search: string,
) {
  const dbRole = toDbRole(friendlyRole);
  const limit = PAGE_SIZE;

  const basePipeline = buildAggregationPipeline(
    statusQuery,
    adminClerkIds,
    search,
    { role: dbRole },
  );

  // Count total matches for this role
  const countPipeline = [...basePipeline, { $count: "total" }];
  const [countResult] = await User.aggregate(countPipeline);
  const total = countResult?.total || 0;

  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const skip = (safePage - 1) * limit;

  // Fetch paginated users
  const dataPipeline = [
    ...basePipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  if (!search) {
    dataPipeline.push({
      $lookup: {
        from: "profiles",
        localField: "clerkId",
        foreignField: "clerkId",
        as: "profile",
      },
    });
    dataPipeline.push({
      $unwind: { path: "$profile", preserveNullAndEmptyArrays: true },
    });
  }

  const pageUsers = await User.aggregate(dataPipeline);
  const creatorIds = pageUsers
    .map((user) => user.createdByAdminClerkId)
    .filter((id): id is string => Boolean(id));
  const creatorAdmins = await Admin.find({
    $or: creatorIds.map((clerkId) => ({ clerkId })),
  })
    .select("clerkId username")
    .lean();
  const creatorNames = new Map(
    creatorAdmins.map((admin) => [String(admin.clerkId), admin.username]),
  );

  const client = await clerkClient();
  const users = (
    await Promise.all(
      pageUsers.map(async (user) => {
        const clerkIdStr = String(user.clerkId);
        const profileData = user.profile;

        let clerkData: any = null;
        try {
          clerkData = await client.users.getUser(clerkIdStr);
        } catch (err: any) {
          if (err.status !== 404) {
            console.error(
              `[app-users] Failed to fetch clerk user ${clerkIdStr}:`,
              err.message || err,
            );
          }
        }

        if (
          clerkData &&
          isClerkAdmin(clerkData.publicMetadata as Record<string, unknown>)
        ) {
          return null;
        }

        const primaryEmail = clerkData?.emailAddresses?.find(
          (e: { id: string; emailAddress: string }) =>
            e.id === clerkData.primaryEmailAddressId,
        );
        const email =
          primaryEmail?.emailAddress ??
          clerkData?.emailAddresses?.[0]?.emailAddress ??
          null;
        const displayName =
          profileData?.displayName ??
          clerkData?.fullName?.trim() ??
          clerkData?.username ??
          null;
        const avatarUrl = profileData?.avatarUrl ?? clerkData?.imageUrl ?? null;
        const lastLogin = toIsoString(clerkData?.lastSignInAt);

        return {
          id: String(user._id),
          clerkId: clerkIdStr,
          username: user.username,
          name: displayName ?? user.username,
          email,
          phone: profileData?.phone ?? null,
          whatsapp: profileData?.whatsapp ?? null,
          role: user.role,
          status: user.status,
          onboardingCompleted: user.onboardingCompleted,
          detailsCompleted: Boolean(user.detailsCompleted),
          paymentCompleted: Boolean(user.paymentCompleted),
          whatsappGroupCompleted: Boolean(user.whatsappGroupCompleted),
          createdByAdmin: Boolean(user.createdByAdmin),
          createdByAdminClerkId: user.createdByAdminClerkId ?? null,
          createdByAdminUsername: user.createdByAdminClerkId
            ? (creatorNames.get(String(user.createdByAdminClerkId)) ?? null)
            : null,
          hasTuitionAccess: Boolean(user.hasTuitionAccess),
          hasCandidateAccess: Boolean(user.hasCandidateAccess),
          plan: user.plan,
          avatarUrl,
          lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          location: profileData?.location ?? null,
          qualification: profileData?.qualification ?? null,
          board: profileData?.board ?? null,
          profileUrl: `/u/${encodeURIComponent(user.username)}`,
          verifyUrl: `/verify/${encodeURIComponent(`AOTF-${user.role === "teacher_candidate" ? "C" : "T"}-${user.username.toUpperCase()}`)}`,
        };
      }),
    )
  ).filter((u): u is NonNullable<typeof u> => u !== null);

  return {
    users,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
}

async function buildGlobalSummary(
  statusQuery: Record<string, unknown>,
  adminClerkIds: Set<string>,
  search: string,
) {
  const pipeline = buildAggregationPipeline(statusQuery, adminClerkIds, search);

  pipeline.push({
    $group: {
      _id: null,
      total: { $sum: 1 },
      active: {
        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
      },
      blocked: {
        $sum: { $cond: [{ $eq: ["$status", "blocked"] }, 1, 0] },
      },
      deleted: {
        $sum: { $cond: [{ $eq: ["$status", "deleted"] }, 1, 0] },
      },
      teachers: {
        $sum: { $cond: [{ $eq: ["$role", "teacher"] }, 1, 0] },
      },
      candidates: {
        $sum: { $cond: [{ $eq: ["$role", "teacher_candidate"] }, 1, 0] },
      },
    },
  });

  const [result] = await User.aggregate(pipeline);
  if (!result) {
    return {
      total: 0,
      active: 0,
      blocked: 0,
      deleted: 0,
      teachers: 0,
      candidates: 0,
    };
  }

  return {
    total: result.total,
    active: result.active,
    blocked: result.blocked,
    deleted: result.deleted,
    teachers: result.teachers,
    candidates: result.candidates,
  };
}

export async function POST(req: Request) {
  await dbConnect();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireManageUsersAdmin(userId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    role?: AdminCreateAppUserRole;
    legalAcceptedAt?: string;
  };

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const role = body.role ?? "teacher";
  const legalAcceptedAt = body.legalAcceptedAt?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!legalAcceptedAt || Number.isNaN(Date.parse(legalAcceptedAt))) {
    return NextResponse.json(
      { error: "Legal acceptance time is required" },
      { status: 400 },
    );
  }
  if (role !== "teacher" && role !== "candidate") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const result = await createAppUser({
    name,
    email,
    role,
    legalAcceptedAt,
    creatorClerkId: userId,
  });
  if (!result.success) {
    const status = result.code === "duplicate_email" ? 409 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json({ ok: true, user: result }, { status: 201 });
}

export async function GET(req: Request) {
  await dbConnect();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireManageUsersAdmin(userId);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const filters: UserFilter = {
    role: searchParams.get("role") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    bundle: searchParams.get("bundle") ?? undefined,
    sync: searchParams.get("sync") ?? undefined,
  };

  let syncResult = null;
  if (filters.sync === "1") {
    try {
      syncResult = await syncClerkAppUsers();
    } catch (err) {
      console.error("[app-users] Clerk sync failed:", err);
    }
  }

  const adminClerkIds = await getAdminClerkIds();
  const statusQuery = buildStatusQuery(filters.status);
  const search = normalizeText(filters.search);
  const summary = await buildGlobalSummary(statusQuery, adminClerkIds, search);

  if (filters.bundle === "1") {
    const [teacherPage, candidatePage] = await Promise.all([
      fetchRolePage("teacher", 1, statusQuery, adminClerkIds, search),
      fetchRolePage("candidate", 1, statusQuery, adminClerkIds, search),
    ]);

    return NextResponse.json({
      summary,
      byRole: {
        teacher: teacherPage,
        candidate: candidatePage,
      },
      sync: syncResult,
    });
  }

  const friendlyRole = filters.role === "candidate" ? "candidate" : "teacher";
  const page = Math.max(Number(filters.page ?? 1) || 1, 1);
  const rolePage = await fetchRolePage(
    friendlyRole,
    page,
    statusQuery,
    adminClerkIds,
    search,
  );

  return NextResponse.json({
    users: rolePage.users,
    summary,
    pagination: rolePage.pagination,
    sync: syncResult,
  });
}
