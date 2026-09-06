"use client";

import { reportClientError } from "@/lib/client-report-error";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import AdminSearchBar, {
  FilterConfig,
} from "@/components/admin/ui/AdminSearchBar";
import DateChips from "@/components/admin/ui/DateChips";
import { tuitionListFilterConfigs } from "@/lib/validations/forms";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  TuitionPostCard,
  TuitionPost,
} from "@/components/admin/postcards/TuitionPostCard";
import {
  AlertTriangle,
  Plus,
  Receipt,
  RefreshCw,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { siteConfig } from "@/config/site";
import { shareOnWhatsApp } from "@/lib/utils/share";

/** Map a DB post (from API) to the TuitionPost interface used by the card. */
function mapApiPost(p: Record<string, any>): TuitionPost {
  return {
    id: p.postId,
    enquiryReferenceId: p.enquiryReferenceId ?? undefined,
    guardian: p.guardianName,
    guardianPhone: p.guardianPhone,
    students: (p.students ?? []).map((s: any) => ({
      className: s.className,
      board: s.board,
      subjects: s.subjects ?? [],
      subjectsNormalized: s.subjectsNormalized,
    })),
    location: p.location,
    budget: p.monthlyBudget ?? 0,
    classType: p.classType,
    frequency: p.frequencyPerWeek ?? 0,
    preferredDays: p.preferredDays ?? [],
    preferredTime: p.preferredTime,
    notes: p.notes ?? "",
    status: p.status ?? "open",
    type: "post",
    invoiceId: p.invoiceId,
    invoiceGenerated: p.invoiceGenerated,
    applicantCount: p.applicantCount ?? 0,
    applicationStats: {
      pending: p.applicationStats?.pending ?? 0,
      DC: 0,
      GC: 0,
      approved: p.applicationStats?.approved ?? 0,
      declined: p.applicationStats?.declined ?? 0,
      withdrawn: p.applicationStats?.withdrawn ?? 0,
      total: p.applicationStats?.total ?? p.applicantCount ?? 0,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ─── Invoice Modal Form ──────────────────────────────────────────────────────

interface InvoiceFormState {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  invoiceDate: string;
  dueDate: string;
  itemName: string;
  itemDescription: string;
  unitAmount: number;
  notes: string;
  paymentStatus: "paid" | "unpaid" | "partial";
  paymentDate: string;
  partialMode: "amount" | "percent";
  partialAmount: string;
  partialPct: string;
  currency: string;
  teacherName: string;
  teacherPhone: string;
}

interface ExistingInvoiceRecord {
  invoiceId: string;
  recipient?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  amount?: {
    currency?: string;
    grandTotal?: number;
  };
  breakdown?: {
    items?: Array<{
      name?: string;
      description?: string;
      quantity?: number;
      unitAmount?: number;
      total?: number;
      postDetails?: {
        postId?: string;
        preferredTime?: string;
        preferredDays?: string[];
        location?: string;
        classType?: string;
        frequencyPerWeek?: number;
      };
    }>;
    notes?: string;
  };
  paymentStatus?: "paid" | "unpaid" | "partial";
  paymentDate?: string;
  invoiceDate?: string;
  dueDate?: string;
  partialPayment?: {
    amountPaid?: number;
    percentagePaid?: number;
  };
  assignedTeacher?: {
    name?: string;
    phone?: string;
  };
}

function InvoiceModal({
  post,
  onClose,
  onSuccess,
}: {
  post: TuitionPost;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const safeStudents = post.students ?? [];
  const subjectDisplay =
    safeStudents.flatMap((s) => s.subjects).join(", ") || "N/A";
  const classDisplay = safeStudents.map((s) => s.className).join(", ");
  const boardDisplay = safeStudents.map((s) => s.board).join(", ");

  const [form, setForm] = useState<InvoiceFormState>({
    recipientName: post.guardian,
    recipientPhone: post.guardianPhone,
    recipientAddress: post.location,
    invoiceDate: today,
    dueDate: due,
    itemName: `${subjectDisplay} - Class ${classDisplay}`,
    itemDescription: `${post.classType} tutoring | ${post.frequency} days/week | ${boardDisplay} board`,
    unitAmount: post.budget ?? 0,
    notes: "",
    paymentStatus: "unpaid",
    paymentDate: today,
    partialMode: "amount",
    partialAmount: "",
    partialPct: "",
    currency: "INR",
    teacherName: "",
    teacherPhone: "",
  });

  const [fetchingTeacher, setFetchingTeacher] = useState(true);

  // Auto-fetch the approved application for this post to pre-fill teacher
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/posts/${post.id}/applications`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const apps: Array<{
            status: string;
            applicantSnapshot?: { name?: string; phone?: string };
          }> = data.applications ?? [];
          const approved = apps.find((a) => a.status === "approved");
          if (approved?.applicantSnapshot) {
            const snap = approved.applicantSnapshot;
            setForm((p) => {
              if (p.teacherName.trim()) return p;
              return {
                ...p,
                teacherName: snap.name ?? "",
                teacherPhone: snap.phone ?? "",
              };
            });
          }
        }
      } catch {
        // silently ignore — admin can fill manually
      } finally {
        setFetchingTeacher(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const [saving, setSaving] = useState(false);
  const [existingInvoice, setExistingInvoice] =
    useState<ExistingInvoiceRecord | null>(null);
  const [loadingExistingInvoice, setLoadingExistingInvoice] = useState(false);

  const total = form.unitAmount;
  const existingRate =
    existingInvoice?.breakdown?.items?.[0]?.unitAmount ?? null;
  const allowRateEdit = existingInvoice
    ? (existingRate ?? existingInvoice.amount?.grandTotal ?? 0) === 0
    : form.unitAmount === 0;

  const set = (k: keyof InvoiceFormState, v: string | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let active = true;

    const fetchExistingInvoice = async () => {
      setLoadingExistingInvoice(true);
      try {
        const res = await fetch(
          `/api/admin/invoices?postId=${encodeURIComponent(post.id)}&limit=1`,
          { credentials: "include" },
        );
        if (!res.ok) return;

        const data = await res.json();
        const invoice = (data.invoices?.[0] ??
          null) as ExistingInvoiceRecord | null;
        if (!active || !invoice) return;

        setExistingInvoice(invoice);

        const firstItem = invoice.breakdown?.items?.[0];
        setForm((prev) => ({
          ...prev,
          recipientName: invoice.recipient?.name ?? prev.recipientName,
          recipientPhone: invoice.recipient?.phone ?? prev.recipientPhone,
          recipientAddress: invoice.recipient?.address ?? prev.recipientAddress,
          invoiceDate: invoice.invoiceDate
            ? new Date(invoice.invoiceDate).toISOString().slice(0, 10)
            : prev.invoiceDate,
          dueDate: invoice.dueDate
            ? new Date(invoice.dueDate).toISOString().slice(0, 10)
            : prev.dueDate,
          itemName: firstItem?.name ?? prev.itemName,
          itemDescription: firstItem?.description ?? prev.itemDescription,
          unitAmount:
            firstItem?.unitAmount ??
            invoice.amount?.grandTotal ??
            prev.unitAmount,
          notes: invoice.breakdown?.notes ?? prev.notes,
          paymentStatus: invoice.paymentStatus ?? prev.paymentStatus,
          paymentDate: invoice.paymentDate
            ? new Date(invoice.paymentDate).toISOString().slice(0, 10)
            : prev.paymentDate,
          partialMode: invoice.partialPayment?.amountPaid
            ? "amount"
            : prev.partialMode,
          partialAmount:
            invoice.partialPayment?.amountPaid?.toString() ??
            prev.partialAmount,
          partialPct:
            invoice.partialPayment?.percentagePaid?.toString() ??
            prev.partialPct,
          currency: invoice.amount?.currency ?? prev.currency,
          teacherName: invoice.assignedTeacher?.name ?? prev.teacherName,
          teacherPhone: invoice.assignedTeacher?.phone ?? prev.teacherPhone,
        }));
      } catch {
        // Keep the post defaults if there is no invoice or the fetch fails.
      } finally {
        if (active) setLoadingExistingInvoice(false);
      }
    };

    fetchExistingInvoice();

    return () => {
      active = false;
    };
  }, [post.id]);

  const handleAmountChange = (v: string) => {
    set("partialAmount", v);
    const n = parseFloat(v);
    if (!isNaN(n) && total > 0)
      set("partialPct", ((n / total) * 100).toFixed(2));
  };

  const handlePctChange = (v: string) => {
    set("partialPct", v);
    const n = parseFloat(v);
    if (!isNaN(n)) set("partialAmount", ((n / 100) * total).toFixed(2));
  };

  const handleSubmit = async () => {
    if (!form.recipientName.trim()) {
      addToast({ description: "Recipient name is required", color: "danger" });
      return;
    }
    if (!form.unitAmount || form.unitAmount <= 0) {
      addToast({
        description: "Amount must be greater than 0",
        color: "danger",
      });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        recipientName: form.recipientName,
        recipientPhone: form.recipientPhone,
        recipientAddress: form.recipientAddress,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        postId: post.id,
        notes: form.notes || undefined,
        items: [
          {
            name: form.itemName,
            description: form.itemDescription,
            quantity: 1,
            unitAmount: Number(form.unitAmount),
            total: Number(form.unitAmount),
            postDetails: {
              postId: post.id,
              preferredTime: post.preferredTime,
              preferredDays: post.preferredDays,
              location: post.location,
              classType: post.classType,
              frequencyPerWeek: post.frequency,
            },
          },
        ],
        currency: form.currency,
        taxPercentage: 0,
        taxAmount: 0,
        subTotal: total,
        grandTotal: total,
        paymentStatus: form.paymentStatus,
        paymentDate:
          form.paymentStatus !== "unpaid" ? form.paymentDate : undefined,
      };

      if (form.paymentStatus === "partial") {
        if (form.partialMode === "amount") {
          body.partialAmountPaid = parseFloat(form.partialAmount);
        } else {
          body.partialPercentagePaid = parseFloat(form.partialPct);
        }
      }

      // Include teacher if provided
      if (form.teacherName.trim()) {
        body.assignedTeacherName = form.teacherName.trim();
        body.assignedTeacherPhone = form.teacherPhone.trim() || undefined;
      }

      const endpoint = existingInvoice
        ? `/api/admin/invoices/${existingInvoice.invoiceId}`
        : "/api/admin/invoices";

      const res = await fetch(endpoint, {
        method: existingInvoice ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        addToast({
          description: "Session expired. Please log in again.",
          color: "danger",
        });
        router.push("/admin/login");
        return;
      }

      const data = await res.json();
      if (data.success) {
        addToast({
          description: existingInvoice
            ? `Invoice ${data.invoice.invoiceId} updated!`
            : `Invoice ${data.invoice.invoiceId} created!`,
          color: "success",
        });
        onSuccess(data.invoice.invoiceId);
      } else {
        addToast({
          description: data.message || "Failed to create invoice",
          color: "danger",
        });
      }
    } catch {
      addToast({ description: "Network error", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-default-300 bg-default-50 text-sm focus:outline-none focus:border-primary";
  const labelCls = "text-xs font-semibold text-default-600 block mb-1";

  return (
    <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
      {/* Post reference */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-50 border border-secondary-200">
        <Receipt size={16} className="text-secondary-600" />
        <span className="text-sm text-secondary-700 font-medium">
          Linked to post:
        </span>
        <span className="font-mono text-sm font-bold text-secondary-800">
          {post.id}
        </span>
      </div>

      {/* Recipient */}
      <div>
        <p className="text-xs font-semibold text-default-500 uppercase tracking-wider mb-2">
          Recipient (Guardian)
        </p>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              className={inputCls}
              value={form.recipientName}
              readOnly
              disabled
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={form.recipientPhone}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input
                className={inputCls}
                value={form.recipientAddress}
                onChange={(e) => set("recipientAddress", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Teacher */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-default-500 uppercase tracking-wider">
            Assigned Teacher
          </p>
          {fetchingTeacher && (
            <span className="text-xs text-default-400 italic">
              Auto-fetching…
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-default-50 border border-default-200">
          <div>
            <label className={labelCls}>Teacher Name</label>
            <input
              className={inputCls}
              value={form.teacherName}
              readOnly
              disabled
              placeholder="Auto-filled if approved"
            />
          </div>
          <div>
            <label className={labelCls}>Teacher Phone</label>
            <input
              className={inputCls}
              value={form.teacherPhone}
              readOnly
              disabled
              placeholder="Auto-filled if approved"
            />
          </div>
        </div>
        <p className="text-xs text-default-400 mt-1">
          Auto-filled from the approved application.
        </p>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Invoice Date *</label>
          <input
            type="date"
            className={inputCls}
            value={form.invoiceDate}
            readOnly
            disabled
          />
        </div>
        <div>
          <label className={labelCls}>Due Date</label>
          <input
            type="date"
            className={inputCls}
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </div>
      </div>

      {/* Line item */}
      <div>
        <p className="text-xs font-semibold text-default-500 uppercase tracking-wider mb-2">
          Service Item
        </p>
        <div className="space-y-2">
          <div>
            <label className={labelCls}>Item Name</label>
            <input
              className={inputCls}
              value={form.itemName}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={inputCls}
              value={form.itemDescription}
              readOnly
              disabled
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Rate (₹)</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.unitAmount}
                readOnly={!allowRateEdit}
                disabled={!allowRateEdit}
                onChange={(e) => set("unitAmount", Number(e.target.value || 0))}
                placeholder={allowRateEdit ? "Enter rate" : undefined}
              />
              {!allowRateEdit && (
                <p className="text-[11px] text-default-400 mt-1">
                  The rate is locked because this invoice already has a non-zero
                  amount.
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Total</label>
              <input
                className={inputCls + " opacity-60"}
                value={`₹${total.toLocaleString("en-IN")}`}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea
          className={inputCls + " resize-none"}
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Thank you for choosing us!"
        />
      </div>

      {/* Payment status */}
      <div>
        <p className="text-xs font-semibold text-default-500 uppercase tracking-wider mb-2">
          Payment Status
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["unpaid", "paid", "partial"] as const).map((s) => {
            const colors: Record<string, string> = {
              unpaid: "border-warning-400 bg-warning-50 text-warning-700",
              paid: "border-success-400 bg-success-50 text-success-700",
              partial:
                "border-secondary-400 bg-secondary-50 text-secondary-700",
            };
            return (
              <button
                key={s}
                onClick={() => set("paymentStatus", s)}
                className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all capitalize ${form.paymentStatus === s ? colors[s] : "border-default-200 bg-default-50 text-default-600"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment date */}
      {form.paymentStatus !== "unpaid" && (
        <div>
          <label className={labelCls}>Payment Date</label>
          <input
            type="date"
            className={inputCls}
            value={form.paymentDate}
            onChange={(e) => set("paymentDate", e.target.value)}
          />
        </div>
      )}

      {/* Partial fields */}
      {form.paymentStatus === "partial" && (
        <div className="space-y-3 p-3 rounded-lg bg-secondary-50 border border-secondary-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-secondary-700">
              Amount Paid
            </p>
            <div className="flex rounded-lg overflow-hidden border border-secondary-300">
              <button
                onClick={() => set("partialMode", "amount")}
                className={`px-3 py-1 text-xs font-medium ${form.partialMode === "amount" ? "bg-secondary-500 text-white" : "bg-white text-secondary-700"}`}
              >
                ₹ Amount
              </button>
              <button
                onClick={() => set("partialMode", "percent")}
                className={`px-3 py-1 text-xs font-medium ${form.partialMode === "percent" ? "bg-secondary-500 text-white" : "bg-white text-secondary-700"}`}
              >
                % Percent
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls + " text-secondary-600"}>
                Amount (₹)
              </label>
              <input
                type="number"
                min={0}
                max={total}
                className={inputCls}
                value={form.partialAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="e.g. 2500"
              />
            </div>
            <div>
              <label className={labelCls + " text-secondary-600"}>
                Percentage (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                className={inputCls}
                value={form.partialPct}
                onChange={(e) => handlePctChange(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
          </div>
          <p className="text-xs text-secondary-600">
            Due after: ₹
            {Math.max(
              0,
              total - (parseFloat(form.partialAmount) || 0),
            ).toLocaleString("en-IN")}
          </p>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="flat"
          onPress={onClose}
          className="flex-1"
          isDisabled={saving}
        >
          Cancel
        </Button>
        <Button
          color="secondary"
          onPress={handleSubmit}
          isLoading={saving}
          className="flex-1"
        >
          {existingInvoice ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Tuitions Page ──────────────────────────────────────────────────────

const Page = () => {
  const router = useRouter();

  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [dateRange, setDateRange] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDateChip, setSelectedDateChip] = useState<string>("");
  const [postToCancel, setPostToCancel] = useState<TuitionPost | null>(null);
  const [invoicePost, setInvoicePost] = useState<TuitionPost | null>(null);

  const cancelDisclosure = useDisclosure();
  const invoiceDisclosure = useDisclosure();
  const shareDisclosure = useDisclosure();
  const [shareInvoiceId, setShareInvoiceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [isCancelling, setIsCancelling] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<TuitionPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    limit: 10,
  });

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", pagination.limit.toString());
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/v1/posts?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch posts (${res.status})`);
      }
      const data = await res.json();
      const mapped: TuitionPost[] = (data.posts ?? []).map(mapApiPost);
      setPosts(mapped);
      setPagination(
        data.pagination ?? {
          page: 1,
          total: mapped.length,
          totalPages: 1,
          limit: 10,
        },
      );
    } catch (err) {
      reportClientError(err, { feature: "admin-tuitions" });
      setFetchError(
        err instanceof Error ? err.message : "Failed to fetch posts",
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        fetchPosts();
      },
      searchQuery ? 400 : 0,
    );
    return () => clearTimeout(timer);
  }, [fetchPosts, searchQuery]);

  // Client-side filtering
  const filteredPosts = useMemo(() => {
    let filtered = [...posts];
    if (filterStatus)
      filtered = filtered.filter((p) => p.status === filterStatus);
    if (selectedYear || selectedMonth || selectedDay) {
      filtered = filtered.filter((post) => {
        const dateStr = post.id.split("-")[1];
        if (!dateStr || dateStr.length < 6) return true;
        const day = parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const year = 2000 + parseInt(dateStr.substring(4, 6));
        return (
          (!selectedYear || year === parseInt(selectedYear)) &&
          (!selectedMonth || month === parseInt(selectedMonth)) &&
          (!selectedDay || day === parseInt(selectedDay))
        );
      });
    }
    if (dateRange?.start && dateRange?.end) {
      filtered = filtered.filter((post) => {
        const dateStr = post.id.split("-")[1];
        if (!dateStr || dateStr.length < 6) return true;
        const day = parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const year = 2000 + parseInt(dateStr.substring(4, 6));
        const postDate = new Date(year, month - 1, day);
        const startDate = new Date(
          dateRange.start.year,
          dateRange.start.month - 1,
          dateRange.start.day,
        );
        const endDate = new Date(
          dateRange.end.year,
          dateRange.end.month - 1,
          dateRange.end.day,
        );
        return postDate >= startDate && postDate <= endDate;
      });
    }
    if (selectedDateChip) {
      filtered = filtered.filter(
        (p) => p.createdAt?.slice(0, 10) === selectedDateChip,
      );
    }
    return filtered;
  }, [
    posts,
    selectedYear,
    selectedMonth,
    selectedDay,
    dateRange,
    filterStatus,
    selectedDateChip,
  ]);

  const tuitionFilterValues: Record<string, string> = {
    status: filterStatus,
    year: selectedYear,
    month: selectedMonth,
    day: selectedDay,
  };

  // If user navigated back from a post view, scroll that post into view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.sessionStorage.getItem("admin_tuitions_last_view");
    if (!id) return;

    const t = setTimeout(() => {
      const el = document.getElementById(`tuition-post-${id}`);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          el.scrollIntoView();
        }
        window.sessionStorage.removeItem("admin_tuitions_last_view");
      }
    }, 50);

    return () => clearTimeout(t);
  }, [posts, filteredPosts, isLoading]);

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") setFilterStatus(value);
    else if (key === "year") setSelectedYear(value);
    else if (key === "month") setSelectedMonth(value);
    else if (key === "day") setSelectedDay(value);
  };

  const handleClearFilters = () => {
    setFilterStatus("");
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedDay("");
    setDateRange(null);
    setSearchQuery("");
    setSelectedDateChip("");
  };

  const handleCancel = (post: TuitionPost) => {
    setPostToCancel(post);
    cancelDisclosure.onOpen();
  };

  const handleGenerateInvoice = (post: TuitionPost) => {
    setInvoicePost(post);
    invoiceDisclosure.onOpen();
  };

  const confirmCancel = async () => {
    if (!postToCancel) return;
    setIsCancelling(true);
    try {
      const nextStatus =
        postToCancel.status === "cancelled" ? "open" : "cancelled";
      const res = await fetch(`/api/v1/posts/${postToCancel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update post");
      }
      addToast({
        description:
          nextStatus === "cancelled" ? "Post cancelled!" : "Post restored!",
        color: "success",
      });
      fetchPosts();
      cancelDisclosure.onClose();
      setPostToCancel(null);
    } catch (err) {
      reportClientError(err, { feature: "admin-tuitions" });
      addToast({
        description: err instanceof Error ? err.message : "Failed to update",
        color: "danger",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleView = (post: TuitionPost) =>
    ((): void => {
      try {
        if (typeof window !== "undefined")
          window.sessionStorage.setItem("admin_tuitions_last_view", post.id);
      } catch {
        /* ignore */
      }
      router.push(`/admin/tuitions/${post.id}`);
    })();
  const handleEdit = (post: TuitionPost) =>
    router.push(`/admin/tuitions/${post.id}/edit`);

  return (
    <div className="container mx-auto px-4 w-full max-w-7xl">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-default-900">
            Tuition Management
          </h1>
        </div>

        {/* Search + Filter */}
        <AdminSearchBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Guardian, location, subject…"
          filters={tuitionListFilterConfigs as unknown as FilterConfig[]}
          filterValues={tuitionFilterValues}
          onFilterChange={handleFilterChange}
          resultCount={filteredPosts.length}
          resultLabel="post"
          onClearAll={handleClearFilters}
        />

        {/* Date chips */}
        <DateChips selected={selectedDateChip} onChange={setSelectedDateChip} />

        {/* Results */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardBody className="py-12 flex items-center justify-center">
                <Spinner size="lg" label="Loading posts..." />
              </CardBody>
            </Card>
          ) : fetchError ? (
            <Card>
              <CardBody className="py-12 text-center space-y-3">
                <p className="text-danger">{fetchError}</p>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={fetchPosts}
                >
                  Retry
                </Button>
              </CardBody>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardBody className="py-12 text-center">
                <p className="text-default-400">
                  No posts found matching your filters
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <TuitionPostCard
                  key={post.id}
                  post={post}
                  onCancel={handleCancel}
                  onView={handleView}
                  onEdit={handleEdit}
                  onGenerateInvoice={handleGenerateInvoice}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={cancelDisclosure.isOpen}
        onClose={cancelDisclosure.onClose}
        size="md"
      >
        <ModalContent>
          {() => {
            const willRestore = postToCancel?.status === "cancelled";
            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      size={24}
                      className={willRestore ? "text-warning" : "text-danger"}
                    />
                    <span>
                      {willRestore
                        ? "Restore Post Confirmation"
                        : "Cancel Post Confirmation"}
                    </span>
                  </div>
                </ModalHeader>
                <ModalBody>
                  <p className="text-default-600">
                    Are you sure you want to{" "}
                    {willRestore ? "restore" : "cancel"} this post?
                  </p>
                  {postToCancel && (
                    <Card className="mt-2">
                      <CardBody className="gap-2">
                        <p className="text-sm">
                          <span className="font-semibold">Post ID:</span>{" "}
                          <span className="text-primary">
                            {postToCancel.id}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Guardian:</span>{" "}
                          {postToCancel.guardian}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Location:</span>{" "}
                          {postToCancel.location}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Status:</span>{" "}
                          <Chip
                            size="sm"
                            color={
                              postToCancel.status === "open"
                                ? "success"
                                : postToCancel.status === "matched"
                                  ? "warning"
                                  : "danger"
                            }
                            variant="flat"
                            className="capitalize"
                          >
                            {postToCancel.status}
                          </Chip>
                        </p>
                      </CardBody>
                    </Card>
                  )}
                  <p
                    className={`text-sm mt-2 ${willRestore ? "text-default-500" : "text-danger-500"}`}
                  >
                    {willRestore
                      ? "This will mark the post as open again."
                      : "You can restore this post later if it was cancelled by mistake."}
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button
                    color="default"
                    variant="light"
                    onPress={cancelDisclosure.onClose}
                    isDisabled={isCancelling}
                  >
                    No, Keep Post
                  </Button>
                  <Button
                    color={willRestore ? "success" : "danger"}
                    onPress={confirmCancel}
                    isLoading={isCancelling}
                  >
                    {willRestore ? "Yes, Restore Post" : "Yes, Cancel Post"}
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal
        isOpen={invoiceDisclosure.isOpen}
        onClose={invoiceDisclosure.onClose}
        size="lg"
        scrollBehavior="inside"
        placement="center"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 pb-0">
                <div className="flex items-center gap-2">
                  <Receipt size={20} className="text-secondary-600" />
                  <span>Generate Invoice</span>
                </div>
                <p className="text-sm font-normal text-default-500">
                  Create and save an invoice for this tuition post
                </p>
                <p className="text-sm text-red-400">
                  *Details are pre filled based on the post information,
                  approved application, and any existing invoice for this post.
                </p>
              </ModalHeader>
              <ModalBody>
                {invoicePost && (
                  <InvoiceModal
                    post={invoicePost}
                    onClose={invoiceDisclosure.onClose}
                    onSuccess={(id) => {
                      invoiceDisclosure.onClose();
                      fetchPosts(); // Refetch posts to update UI state
                      setShareInvoiceId(id);
                      shareDisclosure.onOpen();
                    }}
                  />
                )}
              </ModalBody>
              <ModalFooter />
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Share Invoice Modal */}
      <Modal
        isOpen={shareDisclosure.isOpen}
        onClose={shareDisclosure.onClose}
        size="md"
      >
        <ModalContent>
          {() => {
            const link =
              typeof window !== "undefined"
                ? `${window.location.origin}/invoices/${shareInvoiceId}`
                : "";

            const handleCopy = async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            };

            const handleWhatsApp = () => {
              const text = `Hello! Here is the invoice for the tuition.\n\nYou can view and download it here: ${link}`;
              shareOnWhatsApp(text);
            };

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Share2 size={20} className="text-success-600" />
                    <span>Share Invoice</span>
                  </div>
                  <p className="text-sm font-normal text-default-500">
                    Invoice generated successfully! Share this permanent link.
                  </p>
                </ModalHeader>
                <ModalBody className="pb-6">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-default-100 border border-default-200">
                    <input
                      type="text"
                      readOnly
                      value={link}
                      className="flex-1 bg-transparent text-sm text-default-700 focus:outline-none px-2 font-mono"
                    />
                    <Button
                      size="sm"
                      isIconOnly
                      variant="flat"
                      color={copied ? "success" : "default"}
                      onPress={handleCopy}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                  <Button
                    className="w-full mt-4 bg-[#25D366] text-white font-medium"
                    startContent={<Share2 size={16} />}
                    onPress={handleWhatsApp}
                  >
                    Share via WhatsApp
                  </Button>
                </ModalBody>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Page;
