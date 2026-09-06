"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";
import { FaRupeeSign } from "react-icons/fa";
import type { JobPost } from "@/components/admin/postcards/JobPostCard";

interface InvoiceRecord {
  invoiceId: string;
  amount?: { grandTotal?: number; currency?: string };
  paymentStatus?: "paid" | "unpaid" | "partial";
  paymentDate?: string;
  invoiceDate?: string;
  dueDate?: string;
  recipient?: { name?: string; phone?: string; address?: string };
  breakdown?: { items?: Array<{ unitAmount?: number }>; notes?: string };
}

export default function JobInvoiceModal({
  job,
  onSuccess,
}: {
  job: JobPost;
  onSuccess: (invoiceId: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const fee =
    Math.round(
      (((job.settledAmount ?? 0) * job.academyCommissionPercentage) / 100) *
        100,
    ) / 100;
  const [existing, setExisting] = useState<InvoiceRecord | null>(null);
  const [status, setStatus] = useState<"paid" | "unpaid" | "partial">("unpaid");
  const [paymentDate, setPaymentDate] = useState(today);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(due);
  const [partialAmount, setPartialAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/invoices?postId=${encodeURIComponent(job.id)}&limit=1`, {
      credentials: "include",
    })
      .then(async (res) =>
        res.ok ? ((await res.json()).invoices?.[0] ?? null) : null,
      )
      .then((invoice: InvoiceRecord | null) => {
        if (!invoice) return;
        setExisting(invoice);
        setStatus(invoice.paymentStatus ?? "unpaid");
        if (invoice.paymentDate)
          setPaymentDate(invoice.paymentDate.slice(0, 10));
        if (invoice.invoiceDate)
          setInvoiceDate(invoice.invoiceDate.slice(0, 10));
        if (invoice.dueDate) setDueDate(invoice.dueDate.slice(0, 10));
      })
      .catch(() => undefined);
  }, [job.id]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        recipientName: job.companyName || job.clientName,
        recipientPhone: job.phoneNumber,
        recipientAddress: job.location,
        invoiceDate,
        dueDate,
        paymentStatus: status,
        paymentDate: status === "unpaid" ? undefined : paymentDate,
        partialAmountPaid:
          status === "partial" ? Number(partialAmount) || 0 : undefined,
        currency: "INR",
        subTotal: fee,
        grandTotal: fee,
        notes: `Academy commission: ${job.academyCommissionPercentage}% of client settlement ₹${job.settledAmount ?? 0}.`,
        items: [
          {
            name: `Academy Commission - ${job.title}`,
            description: `Job ID: ${job.id} | Client settlement: ₹${job.settledAmount ?? 0} | Commission: ${job.academyCommissionPercentage}%`,
            quantity: 1,
            unitAmount: fee,
            total: fee,
          },
        ],
      };
      const res = await fetch(
        existing
          ? `/api/admin/invoices/${existing.invoiceId}`
          : "/api/admin/invoices",
        {
          method: existing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || "Failed to save invoice");
      addToast({
        description: existing ? "Job invoice updated" : "Job invoice created",
        color: "success",
      });
      onSuccess(
        data.invoice?.invoiceId ?? data.invoiceId ?? existing?.invoiceId ?? "",
      );
    } catch (error) {
      addToast({
        description:
          error instanceof Error ? error.message : "Failed to save invoice",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-default-100 p-3 text-sm">
        <p>
          <strong>Job:</strong> {job.id}
        </p>
        <p>
          <strong>Client settlement:</strong> ₹
          {(job.settledAmount ?? 0).toLocaleString("en-IN")}
        </p>
        <p>
          <strong>Academy fee:</strong> ₹{fee.toLocaleString("en-IN")} (
          {job.academyCommissionPercentage}%)
        </p>
      </div>
      <Input
        label="Recipient"
        value={job.companyName || job.clientName}
        isReadOnly
        isDisabled
      />
      <Input label="Phone" value={job.phoneNumber} isReadOnly isDisabled />
      <Input
        label="Invoice amount"
        value={String(fee)}
        isReadOnly
        isDisabled
        startContent={<FaRupeeSign />}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Invoice date"
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
        />
        <Input
          label="Due date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <Select
          label="Payment status"
          selectedKeys={[status]}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <SelectItem key="unpaid">Unpaid</SelectItem>
          <SelectItem key="partial">Partial</SelectItem>
          <SelectItem key="paid">Paid</SelectItem>
        </Select>
      </div>
      {status === "partial" && (
        <Input
          label="Amount paid"
          type="number"
          min={0}
          max={fee}
          value={partialAmount}
          onChange={(e) => setPartialAmount(e.target.value)}
        />
      )}
      <Button
        color="primary"
        className="w-full"
        onPress={save}
        isLoading={saving}
        isDisabled={fee <= 0}
      >
        Save invoice
      </Button>
    </div>
  );
}
