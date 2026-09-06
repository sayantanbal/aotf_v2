import { handleApiError } from "@/lib/api-utils";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Invoice from "@/lib/models/Invoice";
import Application from "@/lib/models/Application";
import Post from "@/lib/models/Post";
import Job from "@/lib/models/Job";
import { siteConfig } from "@/config/site";
import { auth } from "@clerk/nextjs/server";
import Admin from "@/lib/models/Admin";
import { logActivity } from "@/lib/admin/logActivity";

// ─── GET /api/admin/invoices ──────────────────────────────────────────────────
// Returns paginated list of invoices ordered by createdAt desc.
// Query params: page, limit, status (paid|unpaid|partial), postId, search

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const status = searchParams.get("status");
    const postId = searchParams.get("postId");
    const search = searchParams.get("search")?.trim();
    const invoiceType = searchParams.get("invoiceType") ?? "all";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (invoiceType === "payout") {
      filter.invoiceId = { $regex: /^INV-PAYOUT-/ };
    } else if (invoiceType === "regular") {
      filter.invoiceId = { $not: /^INV-PAYOUT-/ };
    }

    if (status && ["paid", "unpaid", "partial"].includes(status)) {
      filter.paymentStatus = status;
    }

    if (postId) {
      filter.postId = postId;
    }

    if (search) {
      // If invoiceType already set a regex on invoiceId, we must combine it properly.
      // But it's easier to just use $and for the type filter if search is present.
      const searchOr = [
        { invoiceId: { $regex: search, $options: "i" } },
        { "recipient.name": { $regex: search, $options: "i" } },
        { "recipient.phone": { $regex: search, $options: "i" } },
        { postId: { $regex: search, $options: "i" } },
      ];

      if (filter.invoiceId) {
        // If we already have an invoiceId condition, put them both in $and
        filter.$and = [{ invoiceId: filter.invoiceId }, { $or: searchOr }];
        delete filter.invoiceId;
      } else {
        filter.$or = searchOr;
      }
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/invoices", {
      legacyAdminShape: true,
    });
  }
}

// ─── POST /api/admin/invoices ─────────────────────────────────────────────────
// Creates a new invoice document from the modal form data.

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();

    const {
      // Recipient / billing
      recipientName,
      recipientAddress,
      recipientPhone,
      recipientEmail,

      // Invoice meta
      invoiceDate,
      dueDate,
      postId,
      projectId,
      notes,

      // Items
      items, // [{ name, description, quantity, unitAmount, total, postDetails? }]

      // Financials
      currency = "INR",
      taxPercentage = 0,
      taxAmount = 0,
      subTotal,
      grandTotal,

      // Payment
      paymentStatus = "unpaid",
      paymentDate,
      // Partial payment fields
      partialAmountPaid,
      partialPercentagePaid,
      // Teacher fields (optional — admin can provide or we auto-fetch)
      assignedTeacherName,
      assignedTeacherPhone,
    } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!recipientName) {
      return NextResponse.json(
        { success: false, message: "Recipient name is required" },
        { status: 400 },
      );
    }

    if (!invoiceDate) {
      return NextResponse.json(
        { success: false, message: "Invoice date is required" },
        { status: 400 },
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one line item is required" },
        { status: 400 },
      );
    }

    let linkedJob: {
      jobId: string;
      settledAmount?: number;
      academyCommissionPercentage: number;
    } | null = null;

    if (postId) {
      const existingPost = await Post.findOne({ postId }).lean();
      const existingJob = existingPost
        ? null
        : await Job.findOne({ jobId: postId }).lean<{
            jobId: string;
            settledAmount?: number;
            academyCommissionPercentage: number;
            invoiceGenerated?: boolean;
          }>();
      if (!existingPost && !existingJob) {
        return NextResponse.json(
          { success: false, message: "Post or job not found" },
          { status: 404 },
        );
      }
      if (existingPost?.invoiceGenerated || existingJob?.invoiceGenerated) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invoice already generated for this post. You can only modify the existing invoice.",
          },
          { status: 400 },
        );
      }
      linkedJob = existingJob;
    }

    const calculatedJobFee = linkedJob
      ? Math.round(
          (((Number(linkedJob.settledAmount) || 0) *
            Number(linkedJob.academyCommissionPercentage || 0)) /
            100) *
            100,
        ) / 100
      : null;
    const effectiveGrandTotal = calculatedJobFee ?? (Number(grandTotal) || 0);

    // ── Generate invoiceId ──────────────────────────────────────────────────
    // Format: INV-{postId without prefix}-{4-char random} or INV-{random 8 chars}
    const randomSuffix = () =>
      Math.random().toString(36).toUpperCase().slice(2, 8);

    let invoiceId: string;
    if (postId) {
      // e.g. postId = "P-22042501" → "INV-22042501-AB3F"
      const stripped = postId.replace(/^P-/, "");
      invoiceId = `INV-${stripped}-${randomSuffix()}`;
    } else {
      invoiceId = `INV-${randomSuffix()}`;
    }

    // Ensure uniqueness (rare collision safety)
    let exists = await Invoice.findOne({ invoiceId }).lean();
    let attempts = 0;
    while (exists && attempts < 5) {
      invoiceId = postId
        ? `INV-${postId.replace(/^P-/, "")}-${randomSuffix()}`
        : `INV-${randomSuffix()}`;
      exists = await Invoice.findOne({ invoiceId }).lean();
      attempts++;
    }

    // ── Partial payment ─────────────────────────────────────────────────────
    let partialPayment = undefined;
    if (paymentStatus === "partial") {
      const total = effectiveGrandTotal;
      let amountPaid = 0;
      let pctPaid = 0;

      if (partialAmountPaid !== undefined && partialAmountPaid !== null) {
        amountPaid = Number(partialAmountPaid);
        pctPaid = total > 0 ? Math.min(100, (amountPaid / total) * 100) : 0;
      } else if (
        partialPercentagePaid !== undefined &&
        partialPercentagePaid !== null
      ) {
        pctPaid = Math.min(100, Number(partialPercentagePaid));
        amountPaid = (pctPaid / 100) * total;
      }

      partialPayment = {
        amountPaid: Math.round(amountPaid * 100) / 100,
        percentagePaid: Math.round(pctPaid * 100) / 100,
        amountDue: Math.round((total - amountPaid) * 100) / 100,
      };
    }

    // ── Resolve assigned teacher ────────────────────────────────────────────
    // Use admin-provided values, or fall back to the approved application snapshot
    let assignedTeacher: { name: string; phone?: string } | undefined;

    if (assignedTeacherName) {
      assignedTeacher = {
        name: assignedTeacherName,
        phone: assignedTeacherPhone || undefined,
      };
    } else if (postId) {
      // Try to find the approved application for this post
      const approvedApp = await Application.findOne(
        { postId, status: "approved" },
        { "applicantSnapshot.name": 1, "applicantSnapshot.phone": 1 },
      ).lean();
      if (approvedApp) {
        assignedTeacher = {
          name: approvedApp.applicantSnapshot.name,
          phone: approvedApp.applicantSnapshot.phone || undefined,
        };
      }
    }

    // ── Build document ──────────────────────────────────────────────────────
    const invoice = await Invoice.create({
      invoiceId,
      version: 1,
      isLatest: true,

      source: {
        name: siteConfig.name ?? "Academy of Tutorials & Freelancers",
        address: siteConfig.contact?.address?.street ?? "",
        phone: siteConfig.contact?.phone ?? "",
      },

      recipient: {
        name: recipientName,
        address: recipientAddress,
        phone: recipientPhone,
        email: recipientEmail,
      },

      serviceProvider: {
        name: siteConfig.name ?? "Academy of Tutorials & Freelancers",
        address: siteConfig.contact?.address?.street ?? "",
        phone: siteConfig.contact?.phone ?? "",
        websiteUrl: siteConfig.url ?? "https://www.aotf.in",
        signatureUrl: "/api/v1/admin/private-image?name=sign.png",
      },

      amount: {
        currency,
        subTotal: linkedJob ? effectiveGrandTotal : Number(subTotal) || 0,
        taxPercentage: Number(taxPercentage) || 0,
        taxAmount: Number(taxAmount) || 0,
        grandTotal: effectiveGrandTotal,
      },

      breakdown: {
        items: items.map(
          (item: {
            name: string;
            description?: string;
            quantity: number;
            unitAmount: number;
            total: number;
            postDetails?: object;
          }) => ({
            name: item.name,
            description: item.description,
            quantity: Number(item.quantity),
            unitAmount: Number(item.unitAmount),
            total: Number(item.total),
            postDetails: item.postDetails,
          }),
        ),
        notes,
      },

      paymentStatus,
      partialPayment,
      paymentDate: paymentDate ? new Date(paymentDate) : undefined,
      invoiceDate: new Date(invoiceDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,

      assignedTeacher,
      postId: postId || undefined,
      projectId: projectId || undefined,
    });

    if (postId) {
      await Post.updateOne({ postId }, { $set: { invoiceGenerated: true } });
      await Job.updateOne(
        { jobId: postId },
        { $set: { invoiceGenerated: true, invoiceId } },
      );
    }

    try {
      const { userId } = await auth();
      if (userId) {
        const adminUser = await Admin.findOne({ clerkId: userId }).lean();
        if (adminUser) {
          await logActivity({
            admin: adminUser,
            action: "GENERATE_INVOICE",
            module: "LEDGER",
            targetType: "Invoice",
            targetId: invoice._id as any,
            targetRefId: postId || invoice.invoiceId,
            metadata: {
              invoiceId: invoice.invoiceId,
              postId: postId || undefined,
            },
          });
        }
      }
    } catch (e) {
      console.error("Failed to log GENERATE_INVOICE", e);
    }

    return NextResponse.json(
      {
        success: true,
        invoice: { id: invoice._id, invoiceId: invoice.invoiceId },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/admin/invoices", {
      legacyAdminShape: true,
    });
  }
}
