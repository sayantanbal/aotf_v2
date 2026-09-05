import { notFound } from "next/navigation";
import { EBill } from "@/components/Ebill";
import dbConnect from "@/lib/db";
import Invoice from "@/lib/models/Invoice";
import { tuitionFormDefaults } from "@/lib/validations/forms";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function InvoicePage({ params }: Props) {
  const { id } = await params;

  await dbConnect();
  const invoiceDoc = await Invoice.findOne({ invoiceId: id }).lean();

  if (!invoiceDoc) return notFound();

  // Map Mongoose document to EBill Props format
  const totalQty = invoiceDoc.breakdown.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const isPayoutInvoice = invoiceDoc.invoiceId.startsWith("INV-PAYOUT-");
  const isReferralInvoice = invoiceDoc.invoiceId.startsWith("INV-REF-");

  // For payout invoices: show count. For regular invoices: show the postId.
  const postIdValue = isPayoutInvoice
    ? String(invoiceDoc.breakdown.items.length)
    : isReferralInvoice
      ? (invoiceDoc.referredPostIds?.length ? invoiceDoc.referredPostIds.join(", ") : "N/A")
      : invoiceDoc.postId || "N/A";

  const postIdLabel = isPayoutInvoice ? "Paid Posts" : isReferralInvoice ? "Referred Posts" : "Post ID";
  const jobIdValue = isReferralInvoice
    ? (invoiceDoc.referredJobIds?.length ? invoiceDoc.referredJobIds.join(", ") : "N/A")
    : "N/A";

  const mappedInvoice = {
    orderNumber: invoiceDoc.invoiceId,
    orderType: isPayoutInvoice
      ? "Remuneration"
      : isReferralInvoice
        ? "Referrel"
        : invoiceDoc.postId
          ? "Online Tuition"
          : "Service",
    amount: invoiceDoc.amount.grandTotal,
    date: invoiceDoc.invoiceDate,

    customerName: invoiceDoc.recipient.name,
    phone: invoiceDoc.recipient.phone || "N/A",

    items: invoiceDoc.breakdown.items.map((item: any) => ({
      name: item.name,
      description: item.description,
      qty: item.quantity,
      rate: item.unitAmount,
      price: item.total,
    })),

    subtotal: invoiceDoc.amount.subTotal,
    totalQty,
    sgst: 0,
    cgst: 0,
    roundOff: 0,
    total: invoiceDoc.amount.grandTotal,

    postId: postIdValue,
    referralPhoneNumber: invoiceDoc.referralPhoneNumber || "N/A",
    referredJobIds: jobIdValue,

    enquiryId: undefined,
    invoiceId: invoiceDoc.invoiceId,
    tutorId: "N/A",
    tutorName: isPayoutInvoice ? "—" : invoiceDoc.assignedTeacher?.name || "N/A",
    tutorPhone: isPayoutInvoice ? "—" : invoiceDoc.assignedTeacher?.phone || "N/A",
  };

  return (
    <div className="mb-20">
      <EBill {...mappedInvoice} postLabel={postIdLabel} jobLabel={isReferralInvoice ? "Referred Jobs" : undefined} />

    </div>
  );
}
