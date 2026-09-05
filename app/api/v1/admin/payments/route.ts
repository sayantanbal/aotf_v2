import { handleApiError } from "@/lib/api-utils";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import Invoice from "@/lib/models/Invoice";
import Referral from "@/lib/models/Referral";
import Post from "@/lib/models/Post";
import Job from "@/lib/models/Job";

function stringifyId(value: unknown) {
  if (!value) return undefined;
  return typeof value === "string" ? value : value?.toString?.();
}

function normalizePostKey(value: unknown) {
  return stringifyId(value)?.trim() ?? "";
}

async function getClerkMetadata(userId: string) {
  const { sessionClaims } = await auth();
  let metadata: Record<string, unknown> | undefined =
    sessionClaims?.publicMetadata as Record<string, unknown> | undefined;

  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      metadata = undefined;
    }
  }

  return metadata;
}

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = await getClerkMetadata(userId);
    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (
      !currentAdmin.permissions.canViewPayments &&
      currentAdmin.role !== "super_admin" &&
      currentAdmin.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "You don't have permission to view payments" },
        { status: 403 },
      );
    }

    const [admins, tuitionPosts, jobs] = await Promise.all([
      Admin.find({}, { clerkId: 1, name: 1, role: 1, isActive: 1, email: 1, payoutPercentage: 1 })
        .sort({ name: 1 })
        .lean(),
      Post.find(
        {},
        {
          postId: 1,
          guardianName: 1,
          guardianPhone: 1,
          source: 1,
          monthlyBudget: 1,
          paymentstatus: 1,
          paymentDate: 1,
          tentativeDate: 1,
          createdAt: 1,
          updatedAt: 1,
          createdByAdminClerkId: 1,
          updatedByAdminClerkId: 1,
          status: 1,
        },
      )
        .sort({ createdAt: -1 })
        .lean(),
      Job.find(
        {},
        {
          jobId: 1,
          title: 1,
          clientName: 1,
          phoneNumber: 1,
          source: 1,
          referralUserName: 1,
          createdAt: 1,
          updatedAt: 1,
          createdByAdminId: 1,
          updatedByAdminId: 1,
          status: 1,
        },
      )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const tuitionPostIds = tuitionPosts
      .map((post) => normalizePostKey(post.postId))
      .filter(Boolean);
    const tuitionPostIdSet = new Set(tuitionPostIds);
    const referrals = tuitionPostIds.length
      ? await Referral.find({}, { postId: 1, referralUserName: 1 }).lean()
      : [];

    const referralByPostId = new Map(
      referrals
        .filter(
          (referral) =>
            referral.postId &&
            referral.referralUserName &&
            tuitionPostIdSet.has(normalizePostKey(referral.postId)),
        )
        .map((referral) => [normalizePostKey(referral.postId), referral.referralUserName.trim()]),
    );

    const jobIds = jobs.map((job) => normalizePostKey(job.jobId)).filter(Boolean);
    const jobReferrals = jobIds.length
      ? await Referral.collection
          .find(
            { postId: { $in: jobIds } },
            { projection: { postId: 1, referralUserName: 1 } },
          )
          .toArray()
      : [];

    const referralByJobId = new Map(
      jobReferrals
        .filter((referral) => referral.postId && referral.referralUserName)
        .map((referral) => [
          normalizePostKey(referral.postId),
          referral.referralUserName.trim(),
        ]),
    );

    const invoicePostIdSet = new Set(tuitionPostIds);
    const invoices = tuitionPostIds.length
      ? await Invoice.find({ isLatest: true }, { postId: 1, invoiceId: 1, paymentStatus: 1, paymentDate: 1, isLatest: 1 }).lean()
      : [];

    const invoiceByPostId = new Map(
      invoices
        .filter((invoice) => invoice.postId && invoice.invoiceId && invoicePostIdSet.has(invoice.postId))
        .map((invoice) => [normalizePostKey(invoice.postId), invoice]),
    );

    return NextResponse.json({
      admins: admins.map((admin) => ({
        id: stringifyId(admin._id),
        clerkId: admin.clerkId,
        name: admin.name,
        role: admin.role,
        email: admin.email,
        isActive: admin.isActive,
        payoutPercentage: (admin as any).payoutPercentage ?? 0,
      })),
      tuitionPosts: tuitionPosts.map((post) => {
        const postKey = normalizePostKey(post.postId);
        const invoice = invoiceByPostId.get(postKey);
        return {
          postId: postKey,
          guardianName: post.guardianName,
          guardianPhone: post.guardianPhone,
          source: post.source,
          referralUserName: referralByPostId.get(postKey) ?? "No referral",
          monthlyBudget: post.monthlyBudget,
          paymentstatus: post.paymentstatus,
          paymentDate: post.paymentDate,
          tentativeDate: post.tentativeDate,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          createdByAdminClerkId: post.createdByAdminClerkId,
          updatedByAdminClerkId: post.updatedByAdminClerkId,
          status: post.status,
          invoiceGenerated: Boolean(post.invoiceGenerated),
          invoiceId: invoice?.invoiceId,
          invoicePaymentStatus: invoice?.paymentStatus,
          invoicePaymentDate: invoice?.paymentDate,
        };
      }),
      jobs: jobs.map((job) => ({
        jobId: job.jobId,
        title: job.title,
        clientName: job.clientName,
        phoneNumber: job.phoneNumber,
        source: job.source,
        referralUserName:
          referralByJobId.get(normalizePostKey(job.jobId)) ??
          job.referralUserName ??
          null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        createdByAdminId: stringifyId(job.createdByAdminId),
        updatedByAdminId: stringifyId(job.updatedByAdminId),
        status: job.status,
      })),
    });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/admin/payments");
  }
}