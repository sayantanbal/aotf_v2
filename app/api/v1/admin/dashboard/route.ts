import { handleApiError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import User from "@/lib/models/User";
import Post from "@/lib/models/Post";
import Enquiry from "@/lib/models/Enquiry";
import Payment from "@/lib/models/Payment";
import Invoice from "@/lib/models/Invoice";
import Feedback from "@/lib/models/Feedback";
import AdminActivityLog from "@/lib/models/admin/AdminActivityLog";

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeMonthBounds(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  return {
    monthStart: new Date(year, month, 1, 0, 0, 0, 0),
    monthEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
    prevMonthStart: new Date(year, month - 1, 1, 0, 0, 0, 0),
    prevMonthEnd: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function computeGrowthPct(current: number, previous: number): number {
  const pct = ((current - previous) / Math.max(previous, 1)) * 100;
  return Math.round(pct * 10) / 10;
}

// ─── Role-specific aggregators ──────────────────────────────────────────────

async function getSuperAdminData(adminClerkId: string) {
  const { monthStart, monthEnd, prevMonthStart, prevMonthEnd } =
    computeMonthBounds(new Date());
  const thirtyDaysAgo = daysAgo(30);
  const todayStart = startOfDay(new Date());

  const [
    totalUsers,
    activePosts,
    enquiryBreakdown,
    revenueTotal,
    adminsByRole,
    recentPayments,
    recentEnquiries,
    postsByStatus,
    revenueTrend,
    recentAuditLog,
    totalFeedbacks,
    openFeedbacks,
    postsFacetResult,
    invoiceRevenueThisMonth,
    classificationResult,
    currentMonthUsers,
    prevMonthUsers,
    blockedUsers,
  ] = await Promise.all([
    // Total registered users
    User.countDocuments({ status: "active" }),

    // Active (open) tuition/job posts
    Post.countDocuments({ status: "open" }),

    // Enquiry breakdown: new vs in_progress
    Enquiry.aggregate([
      { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
    ]),

    // Revenue: sum of paid payments
    Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // Admins by role
    Admin.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),

    // Recent payments (last 5)
    Payment.find({ status: "paid" })
      .sort({ paidAt: -1 })
      .limit(5)
      .select("amount purpose status paidAt createdAt")
      .lean(),

    // Recent enquiries (last 5)
    Enquiry.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name query currentStatus createdAt")
      .lean(),

    // Posts by status
    Post.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    // Revenue trend — daily totals for last 30 days
    Payment.aggregate([
      { $match: { status: "paid", paidAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidAt" },
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Audit log (last 5)
    AdminActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("adminUsername adminName action targetType targetRefId createdAt")
      .lean(),

    // Total feedbacks
    Feedback.countDocuments(),

    // Open (unresolved) feedbacks
    Feedback.countDocuments({ status: "open" }),

    // Posts this month: total and paid count
    Post.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
      {
        $facet: {
          totalAndPayment: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                paid: {
                  $sum: { $cond: [{ $eq: ["$paymentstatus", "done"] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]),

    // Invoice revenue this month, grouped by currency. Count only the latest
    // revision so editing an invoice does not double-count its grand total.
    Invoice.aggregate([
      {
        $match: {
          isLatest: true,
          invoiceDate: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: "$amount.currency",
          total: { $sum: "$amount.grandTotal" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Approved / Ongoing / Cancelled post classification this month
    Post.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
      {
        $lookup: {
          from: "applications",
          localField: "postId",
          foreignField: "postId",
          as: "applications",
        },
      },
      {
        $addFields: {
          isApproved: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$applications",
                    cond: { $eq: ["$$this.status", "approved"] },
                  },
                },
              },
              0,
            ],
          },
          hasInProgress: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$applications",
                    cond: { $in: ["$$this.status", ["DC", "GC"]] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          approved: { $sum: { $cond: ["$isApproved", 1, 0] } },
          ongoing: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isApproved", false] },
                    { $ne: ["$status", "cancelled"] },
                    "$hasInProgress",
                  ],
                },
                1,
                0,
              ],
            },
          },
          cancelled: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isApproved", false] },
                    { $eq: ["$status", "cancelled"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    // Current month new users
    User.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),

    // Previous month new users (for growth %)
    User.countDocuments({
      createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
    }),

    // All-time blocked users
    User.countDocuments({ status: "blocked" }),
  ]);

  // Normalise posts facet result — empty array means no posts this month
  const postsFacetRaw = (
    postsFacetResult as Array<{
      totalAndPayment: Array<{ total: number; paid: number }>;
    }>
  )?.[0]?.totalAndPayment?.[0] ?? { total: 0, paid: 0 };
  const unpaid = postsFacetRaw.total - postsFacetRaw.paid;
  const postsThisMonthRaw = {
    total: postsFacetRaw.total,
    paid: postsFacetRaw.paid,
    unpaid,
  };

  const revenueThisMonth = (
    invoiceRevenueThisMonth as Array<{ _id: string; total: number }>
  ).map(({ _id, total }) => ({
    currency: _id || "INR",
    total,
  }));

  // Normalise classification result — empty array means no posts this month
  const classificationRaw = (
    classificationResult as Array<{
      approved: number;
      ongoing: number;
      cancelled: number;
    }>
  )?.[0] ?? { approved: 0, ongoing: 0, cancelled: 0 };
  const approvedPostsThisMonthRaw = {
    approved: classificationRaw.approved,
    ongoing: classificationRaw.ongoing,
    cancelled: classificationRaw.cancelled,
  };

  // Compute growth percentage for users
  const growthPct = computeGrowthPct(
    currentMonthUsers as number,
    prevMonthUsers as number,
  );

  const usersThisMonthRaw = {
    total: currentMonthUsers as number,
    growthPct,
    blocked: blockedUsers as number,
  };

  // Normalise enquiry breakdown into a map
  const enqMap: Record<string, number> = {};
  for (const row of enquiryBreakdown as Array<{ _id: string; count: number }>) {
    enqMap[row._id] = row.count;
  }

  // Normalise admin counts
  const adminMap: Record<string, number> = {};
  for (const row of adminsByRole as Array<{ _id: string; count: number }>) {
    adminMap[row._id] = row.count;
  }

  // Normalise posts by status
  const postsMap: Record<string, number> = {};
  for (const row of postsByStatus as Array<{ _id: string; count: number }>) {
    postsMap[row._id] = row.count;
  }

  return {
    role: "super_admin" as const,
    stats: {
      // ── Existing keys (preserved, unchanged) ────
      totalUsers,
      activePosts,
      enquiries: {
        new: enqMap["new"] ?? 0,
        inProgress: enqMap["in_progress"] ?? 0,
        total: Object.values(enqMap).reduce((a, b) => a + b, 0),
      },
      revenue: (revenueTotal as Array<{ total: number }>)[0]?.total ?? 0,
      admins: adminMap,
      feedbacks: { total: totalFeedbacks, open: openFeedbacks },

      // ── New per-month keys (additive) ────────────────────────────────
      postsThisMonth: {
        total: postsThisMonthRaw.total,
        paid: postsThisMonthRaw.paid,
        unpaid: postsThisMonthRaw.unpaid,
      },
      approvedPostsThisMonth: {
        approved: approvedPostsThisMonthRaw.approved,
        ongoing: approvedPostsThisMonthRaw.ongoing,
        cancelled: approvedPostsThisMonthRaw.cancelled,
      },
      usersThisMonth: {
        total: usersThisMonthRaw.total,
        growthPct: usersThisMonthRaw.growthPct,
        blocked: usersThisMonthRaw.blocked,
      },
      revenueThisMonth,
    },
    postsByStatus: postsMap,
    recentPayments,
    recentEnquiries,
    revenueTrend: revenueTrend as Array<{ _id: string; total: number }>,
    recentAuditLog: recentAuditLog.map((log) => ({
      ...log,
      targetIdentifier: log.targetRefId,
    })),
  };
}

async function getAdminData(adminDoc: {
  clerkId: string;
  _id: mongoose.Types.ObjectId;
}) {
  const [
    activePosts,
    enquiryBreakdown,
    postsByStatus,
    recentEnquiries,
    myPostsCount,
    myEnquiriesCount,
  ] = await Promise.all([
    Post.countDocuments({ status: "open" }),

    Enquiry.aggregate([
      { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
    ]),

    Post.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    Enquiry.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name query currentStatus createdAt")
      .lean(),

    // Posts created by this admin
    Post.countDocuments({ createdByAdminClerkId: adminDoc.clerkId }),

    // Enquiries last touched by this admin
    Enquiry.countDocuments({ lastActionByAdminId: adminDoc._id }),
  ]);

  const enqMap: Record<string, number> = {};
  for (const row of enquiryBreakdown as Array<{ _id: string; count: number }>) {
    enqMap[row._id] = row.count;
  }

  const postsMap: Record<string, number> = {};
  for (const row of postsByStatus as Array<{ _id: string; count: number }>) {
    postsMap[row._id] = row.count;
  }

  return {
    role: "admin" as const,
    stats: {
      activePosts,
      enquiries: {
        new: enqMap["new"] ?? 0,
        inProgress: enqMap["in_progress"] ?? 0,
        total: Object.values(enqMap).reduce((a, b) => a + b, 0),
      },
    },
    postsByStatus: postsMap,
    recentEnquiries,
    myActivity: {
      postsCreated: myPostsCount,
      enquiriesHandled: myEnquiriesCount,
    },
  };
}

async function getSupportAdminData(adminDoc: { _id: mongoose.Types.ObjectId }) {
  const todayStart = startOfDay(new Date());

  const [myOpenEnquiries, myEnquiryBreakdown, handledToday, recentFeedbacks] =
    await Promise.all([
      Enquiry.countDocuments({
        lastActionByAdminId: adminDoc._id,
        currentStatus: { $in: ["new", "in_progress", "contacted"] },
      }),

      Enquiry.aggregate([
        { $match: { lastActionByAdminId: adminDoc._id } },
        { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
      ]),

      Enquiry.countDocuments({
        lastActionByAdminId: adminDoc._id,
        lastActionAt: { $gte: todayStart },
      }),

      Feedback.find({ handledByAdminId: adminDoc._id })
        .sort({ handledAt: -1 })
        .limit(5)
        .select("userSnapshot.name category subject status handledAt createdAt")
        .lean(),
    ]);

  const enqMap: Record<string, number> = {};
  for (const row of myEnquiryBreakdown as Array<{
    _id: string;
    count: number;
  }>) {
    enqMap[row._id] = row.count;
  }

  return {
    role: "support_admin" as const,
    stats: {
      myOpenEnquiries,
      handledToday,
      enquiryBreakdown: {
        new: enqMap["new"] ?? 0,
        inProgress: enqMap["in_progress"] ?? 0,
        contacted: enqMap["contacted"] ?? 0,
        resolved: enqMap["resolved"] ?? 0,
      },
    },
    recentFeedbacks,
  };
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const adminRaw = await Admin.findOne(
      { clerkId: userId },
      { clerkId: 1, role: 1, isActive: 1, _id: 1 },
    ).lean();

    if (!adminRaw || !adminRaw.isActive) {
      return NextResponse.json(
        { error: "Forbidden: admin not active" },
        { status: 403 },
      );
    }

    // Cast _id safely — lean() returns ObjectId at runtime
    const admin = adminRaw as typeof adminRaw & {
      _id: mongoose.Types.ObjectId;
    };

    let data;
    if (admin.role === "super_admin") {
      data = await getSuperAdminData(admin.clerkId);
    } else if (admin.role === "admin") {
      data = await getAdminData(admin);
    } else {
      data = await getSupportAdminData(admin);
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "GET /api/v1/admin/dashboard");
  }
}
