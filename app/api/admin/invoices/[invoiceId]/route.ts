import { handleApiError } from "@/lib/api-utils";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Invoice from "@/lib/models/Invoice";
import Job from "@/lib/models/Job";
import { auth } from "@clerk/nextjs/server";
import Admin from "@/lib/models/Admin";
import { logActivity } from "@/lib/admin/logActivity";

// ─── GET /api/admin/invoices/[invoiceId] ──────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    await dbConnect();
    const { invoiceId } = await params;

    const invoice = await Invoice.findOne({ invoiceId }).lean();
    if (!invoice) {
      return NextResponse.json(
        { success: false, message: "Invoice not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/invoices/[invoiceId]", {
      legacyAdminShape: true,
    });
  }
}

// ─── PUT /api/admin/invoices/[invoiceId] ──────────────────────────────────────
// Updates payment status / partial payment info on an existing invoice.
// For full invoice revisions, a new document (with incremented version) is
// created and the previous one's isLatest is set to false.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    await dbConnect();
    const { invoiceId } = await params;
    const body = await request.json();

    const existing = await Invoice.findOne({ invoiceId });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Invoice not found" },
        { status: 404 },
      );
    }

    const linkedJob = existing.postId
      ? await Job.findOne({ jobId: existing.postId }).lean<{
          settledAmount?: number;
          academyCommissionPercentage: number;
        }>()
      : null;
    const calculatedJobFee = linkedJob
      ? Math.round(
          (((Number(linkedJob.settledAmount) || 0) *
            Number(linkedJob.academyCommissionPercentage || 0)) /
            100) *
            100,
        ) / 100
      : null;

    const {
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientEmail,
      paymentStatus,
      paymentDate,
      partialAmountPaid,
      partialPercentagePaid,
      // Full revision fields
      revisionReason,
      // Allow updating notes, items etc. (treated as a revision)
      items,
      currency,
      taxPercentage,
      taxAmount,
      subTotal,
      grandTotal,
      notes,
      dueDate,
      assignedTeacherName,
      assignedTeacherPhone,
    } = body;

    if (recipientName !== undefined) existing.recipient.name = recipientName;
    if (recipientPhone !== undefined) existing.recipient.phone = recipientPhone;
    if (recipientAddress !== undefined)
      existing.recipient.address = recipientAddress;
    if (recipientEmail !== undefined) existing.recipient.email = recipientEmail;

    if (Array.isArray(items) && items.length > 0) {
      existing.breakdown.items = items.map(
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
      );
    }

    if (currency !== undefined) existing.amount.currency = String(currency);
    if (taxPercentage !== undefined)
      existing.amount.taxPercentage = Number(taxPercentage) || 0;
    if (taxAmount !== undefined)
      existing.amount.taxAmount = Number(taxAmount) || 0;
    if (subTotal !== undefined)
      existing.amount.subTotal = Number(subTotal) || 0;
    if (grandTotal !== undefined || calculatedJobFee !== null)
      existing.amount.grandTotal =
        calculatedJobFee ?? (Number(grandTotal) || 0);
    if (calculatedJobFee !== null) existing.amount.subTotal = calculatedJobFee;

    if (
      assignedTeacherName !== undefined ||
      assignedTeacherPhone !== undefined
    ) {
      existing.assignedTeacher = {
        name: assignedTeacherName ?? existing.assignedTeacher?.name ?? "",
        phone: assignedTeacherPhone ?? existing.assignedTeacher?.phone,
      };
    }

    // ── Partial payment calculation ─────────────────────────────────────────
    let partialPayment = existing.partialPayment;
    if (paymentStatus === "partial") {
      const total =
        calculatedJobFee ??
        (grandTotal !== undefined
          ? Number(grandTotal) || 0
          : existing.amount.grandTotal);
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
      } else if (existing.partialPayment) {
        // Keep existing partial data if no new values provided
        partialPayment = existing.partialPayment;
      }

      if (
        partialAmountPaid !== undefined ||
        partialPercentagePaid !== undefined
      ) {
        partialPayment = {
          amountPaid: Math.round(amountPaid * 100) / 100,
          percentagePaid: Math.round(pctPaid * 100) / 100,
          amountDue:
            Math.round((existing.amount.grandTotal - amountPaid) * 100) / 100,
        };
      }
    } else {
      // If status changed away from partial, clear partial data
      if (paymentStatus === "paid" || paymentStatus === "unpaid") {
        partialPayment = undefined;
      }
    }

    // Apply updates
    if (paymentStatus) existing.paymentStatus = paymentStatus;
    if (paymentDate !== undefined)
      existing.paymentDate = paymentDate ? new Date(paymentDate) : undefined;
    if (partialPayment !== undefined) existing.partialPayment = partialPayment;
    if (notes !== undefined) existing.breakdown.notes = notes;
    if (dueDate !== undefined)
      existing.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (revisionReason) existing.revisionReason = revisionReason;

    await existing.save();

    try {
      const { userId } = await auth();
      if (userId) {
        const adminUser = await Admin.findOne({ clerkId: userId }).lean();
        if (adminUser) {
          await logActivity({
            admin: adminUser,
            action: "UPDATE_INVOICE_STATUS",
            module: "LEDGER",
            targetType: "Invoice",
            targetId: existing._id as any,
            targetRefId: existing.postId || existing.invoiceId,
            metadata: {
              invoiceId: existing.invoiceId,
              postId: existing.postId || undefined,
              status: existing.paymentStatus,
            },
          });
        }
      }
    } catch (e) {
      console.error("Failed to log UPDATE_INVOICE_STATUS", e);
    }

    return NextResponse.json({ success: true, invoice: existing });
  } catch (error) {
    return handleApiError(error, "PUT /api/admin/invoices/[invoiceId]", {
      legacyAdminShape: true,
    });
  }
}

// ─── DELETE /api/admin/invoices/[invoiceId] ───────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    await dbConnect();
    const { invoiceId } = await params;

    const result = await Invoice.deleteOne({ invoiceId });
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Invoice not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    return handleApiError(error, "DELETE /api/admin/invoices/[invoiceId]", {
      legacyAdminShape: true,
    });
  }
}
