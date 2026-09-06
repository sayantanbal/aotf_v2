"use client";

import { reportClientError } from "@/lib/client-report-error";
import { formatPhone } from "@/lib/utils/phone";
import { shareOnWhatsApp } from "@/lib/utils/share";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Tab, Tabs } from "@heroui/tabs";
import { Spinner } from "@heroui/spinner";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  Layers3,
  Percent,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Users,
  BadgeIndianRupee,
  MessageCircle,
} from "lucide-react";
import { months, sourceLists, yearOptions } from "@/lib/validations/forms";
import { Accordion, AccordionItem } from "@heroui/accordion";

type TabKey = "admins" | "source" | "post";
type PostStatusTabKey = "paid" | "unpaid";

type RateMap = Record<string, { tuition: number; job: number }>;

type AdminRow = {
  id?: string;
  clerkId: string;
  name: string;
  role: string;
  email?: string;
  isActive: boolean;
  payoutPercentage: number;
};

type TuitionPostRow = {
  postId: string;
  guardianName: string;
  guardianPhone: string;
  source?: string;
  referralUserName?: string | null;
  monthlyBudget: number;
  paymentstatus?: "done" | "pending";
  paymentDate?: string;
  tentativeDate?: string;
  createdAt: string;
  updatedAt: string;
  createdByAdminClerkId?: string;
  updatedByAdminClerkId?: string;
  status?: string;
  invoiceGenerated?: boolean;
  invoiceId?: string;
  invoicePaymentStatus?: string;
  invoicePaymentDate?: string;
};

type JobRow = {
  jobId: string;
  title: string;
  clientName: string;
  phoneNumber: string;
  source?: string;
  referralUserName?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAdminId?: string;
  updatedByAdminId?: string;
  status?: string;
  invoiceGenerated?: boolean;
  invoiceId?: string;
  invoicePaymentStatus?: string;
  invoicePaymentDate?: string;
  settledAmount?: number | null;
};

type SummaryResponse = {
  admins: AdminRow[];
  tuitionPosts: TuitionPostRow[];
  jobs: JobRow[];
};

type ReferralOption = {
  key: string;
  label: string;
  phone: string;
  count: number;
};

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | Date | null) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isTuitionPaid(post: TuitionPostRow) {
  return (
    post.paymentstatus === "done" ||
    post.invoicePaymentStatus === "paid" ||
    post.invoicePaymentStatus === "partial"
  );
}

function isJobPaid(job: JobRow) {
  return (
    job.invoicePaymentStatus === "paid" ||
    job.invoicePaymentStatus === "partial" ||
    (typeof job.settledAmount === "number" && job.settledAmount > 0)
  );
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  const monthIndex = Number(month) - 1;
  return `${months[monthIndex]?.label ?? ""} ${year}`;
}

export default function PaymentDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("admins");
  const [postStatusTab, setPostStatusTab] = useState<PostStatusTabKey>("paid");
  const [loading, setLoading] = useState(true);
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse>({
    admins: [],
    tuitionPosts: [],
    jobs: [],
  });
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedAdminKey, setSelectedAdminKey] = useState<string>("");
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(
    sourceLists[0]?.key ?? "other",
  );
  const [selectedReferralKey, setSelectedReferralKey] = useState<string>("all");
  const [selectedReferralName, setSelectedReferralName] =
    useState<string>("all");
  const [selectedReferralPhone, setSelectedReferralPhone] =
    useState<string>("");
  const [referralOptions, setReferralOptions] = useState<ReferralOption[]>([]);
  const [referralInvoiceAmount, setReferralInvoiceAmount] =
    useState<string>("");
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>(
    {},
  );

  // ── Payout state ────────────────────────────────────────────────────────
  const [payoutPctDraft, setPayoutPctDraft] = useState<Record<string, string>>(
    {},
  );
  const [savingPct, setSavingPct] = useState(false);
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [payoutLink, setPayoutLink] = useState<string | null>(null);
  const [generatingReferralInvoice, setGeneratingReferralInvoice] =
    useState(false);
  const [referralInvoiceLink, setReferralInvoiceLink] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const now = new Date();
    setSelectedYear(String(now.getFullYear()));
    setSelectedMonth(String(now.getMonth() + 1));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/admin/payments", {
        credentials: "include",
      });
      const payload = (await response.json()) as SummaryResponse & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Failed to load payment data");
      setData(payload);
    } catch (err) {
      reportClientError(err, { feature: "admin-payments-dashboard" });
      addToast({
        description:
          err instanceof Error
            ? err.message
            : "Failed to load payment dashboard",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralOptions = async () => {
    try {
      const response = await fetch("/api/v1/admin/referrals", {
        credentials: "include",
      });
      const payload = (await response.json()) as {
        referrals?: ReferralOption[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load referrals");
      }
      setReferralOptions(
        Array.isArray(payload.referrals) ? payload.referrals : [],
      );
    } catch (err) {
      reportClientError(err, { feature: "admin-referrals-list" });
    }
  };

  useEffect(() => {
    fetchData();
    fetchReferralOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset payout link when admin/month changes
  useEffect(() => {
    setPayoutLink(null);
  }, [selectedAdminKey, selectedYear, selectedMonth]);

  useEffect(() => {
    setReferralInvoiceLink(null);
    setReferralInvoiceAmount("");
  }, [selectedReferralKey, selectedSourceKey, selectedYear, selectedMonth]);

  useEffect(() => {
    if (selectedSourceKey !== "referral") {
      setSelectedReferralKey("all");
      setSelectedReferralName("all");
      setSelectedReferralPhone("");
    }
  }, [selectedSourceKey]);

  // Sync draft pct from loaded data
  useEffect(() => {
    if (!data.admins.length) return;
    setPayoutPctDraft((prev) => {
      const next = { ...prev };
      data.admins.forEach((a) => {
        if (!(a.clerkId in next)) {
          next[a.clerkId] = String(a.payoutPercentage ?? 0);
        }
      });
      return next;
    });
  }, [data.admins]);

  const selectedKey = `${selectedYear}-${selectedMonth}`;

  const filteredTuitionPosts = useMemo(() => {
    return data.tuitionPosts.filter((post) => {
      const created = parseDate(post.createdAt);
      if (!created) return false;
      if (selectedYear && created.getFullYear() !== Number(selectedYear))
        return false;
      if (selectedMonth && String(created.getMonth() + 1) !== selectedMonth)
        return false;
      return true;
    });
  }, [data.tuitionPosts, selectedYear, selectedMonth]);

  const filteredJobs = useMemo(() => {
    return data.jobs.filter((job) => {
      const created = parseDate(job.createdAt);
      if (!created) return false;
      if (selectedYear && created.getFullYear() !== Number(selectedYear))
        return false;
      if (selectedMonth && String(created.getMonth() + 1) !== selectedMonth)
        return false;
      return true;
    });
  }, [data.jobs, selectedYear, selectedMonth]);

  const selectedSource = useMemo(() => {
    if (selectedSourceKey === "all") {
      return { key: "all", label: "All sources" } as any;
    }
    return (
      sourceLists.find((source) => source.key === selectedSourceKey) ??
      sourceLists[0]
    );
  }, [selectedSourceKey]);

  const sourceStats = useMemo(() => {
    const stats = new Map<string, { tuitionCount: number; jobCount: number }>();
    sourceLists.forEach((s) =>
      stats.set(s.key, { tuitionCount: 0, jobCount: 0 }),
    );

    filteredTuitionPosts.forEach((post) => {
      const key = post.source || "other";
      if (!stats.has(key)) stats.set(key, { tuitionCount: 0, jobCount: 0 });
      const entry = stats.get(key)!;
      entry.tuitionCount += 1;
    });

    filteredJobs.forEach((job) => {
      const key = job.source || "other";
      if (!stats.has(key)) stats.set(key, { tuitionCount: 0, jobCount: 0 });
      const entry = stats.get(key)!;
      entry.jobCount += 1;
    });

    return stats;
  }, [filteredTuitionPosts, filteredJobs]);

  const selectedSourceTuitionPosts = useMemo(() => {
    if (selectedSourceKey === "all") return filteredTuitionPosts;
    const sourceFiltered = filteredTuitionPosts.filter(
      (post) => (post.source || "other") === selectedSourceKey,
    );
    if (selectedSourceKey !== "referral" || selectedReferralName === "all") {
      return sourceFiltered;
    }
    return sourceFiltered.filter(
      (post) => (post.referralUserName ?? "").trim() === selectedReferralName,
    );
  }, [filteredTuitionPosts, selectedReferralName, selectedSourceKey]);

  const selectedSourceJobs = useMemo(() => {
    if (selectedSourceKey === "all") return filteredJobs;
    const sourceFiltered = filteredJobs.filter(
      (job) => (job.source || "other") === selectedSourceKey,
    );
    if (selectedSourceKey !== "referral" || selectedReferralName === "all") {
      return sourceFiltered;
    }
    return sourceFiltered.filter(
      (job) => (job.referralUserName ?? "").trim() === selectedReferralName,
    );
  }, [filteredJobs, selectedReferralName, selectedSourceKey]);

  const selectedSourceStats = useMemo(() => {
    if (selectedSourceKey === "all") {
      let tuitionCount = 0;
      let jobCount = 0;
      sourceStats.forEach((v) => {
        tuitionCount += v.tuitionCount;
        jobCount += v.jobCount;
      });
      return { tuitionCount, jobCount };
    }

    if (selectedSourceKey === "referral" && selectedReferralName !== "all") {
      return {
        tuitionCount: selectedSourceTuitionPosts.length,
        jobCount: selectedSourceJobs.length,
      };
    }

    return (
      sourceStats.get(selectedSourceKey) ?? { tuitionCount: 0, jobCount: 0 }
    );
  }, [
    selectedReferralName,
    selectedSourceJobs.length,
    selectedSourceKey,
    selectedSourceTuitionPosts.length,
    sourceStats,
  ]);

  useEffect(() => {
    if (selectedSourceKey !== "referral") {
      setSelectedReferralName("all");
    }
  }, [selectedSourceKey]);

  const postStatusCounts = useMemo(() => {
    const paidTuition = filteredTuitionPosts.filter(isTuitionPaid).length;
    const unpaidTuition = filteredTuitionPosts.length - paidTuition;
    const paidJobs = filteredJobs.filter(isJobPaid).length;
    const unpaidJobs = filteredJobs.length - paidJobs;

    return {
      paid: paidTuition + paidJobs,
      unpaid: unpaidTuition + unpaidJobs,
    };
  }, [filteredJobs, filteredTuitionPosts]);

  const adminStats = useMemo(() => {
    return data.admins.map((admin) => {
      const tuition = filteredTuitionPosts.filter(
        (post) => post.createdByAdminClerkId === admin.clerkId,
      );

      const tuitionPaid = data.tuitionPosts.filter((post) => {
        if (post.createdByAdminClerkId !== admin.clerkId) return false;
        const isPaid =
          post.paymentstatus === "done" ||
          post.invoicePaymentStatus === "paid" ||
          post.invoicePaymentStatus === "partial";
        if (!isPaid) return false;
        const paidDate =
          parseDate(post.paymentDate) || parseDate(post.invoicePaymentDate);
        if (!paidDate) return false;
        if (selectedYear && paidDate.getFullYear() !== Number(selectedYear))
          return false;
        if (selectedMonth && String(paidDate.getMonth() + 1) !== selectedMonth)
          return false;
        return true;
      });

      const jobs = filteredJobs.filter(
        (job) =>
          job.createdByAdminId &&
          data.admins.find((a) => a.id === job.createdByAdminId)?.clerkId ===
          admin.clerkId,
      );

      return {
        clerkId: admin.clerkId,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        tuitionCount: tuition.length,
        tuitionPaidCount: tuitionPaid.length,
        jobCount: jobs.length,
      };
    });
  }, [
    data.admins,
    data.tuitionPosts,
    filteredJobs,
    filteredTuitionPosts,
    selectedYear,
    selectedMonth,
  ]);

  // ── Paid tuition budget total for the selected admin in the period ──────
  const selectedAdminPaidTotal = useMemo(() => {
    if (!selectedAdminKey || selectedAdminKey === "all") return 0;
    return data.tuitionPosts
      .filter((post) => {
        if (post.createdByAdminClerkId !== selectedAdminKey) return false;
        const isPaid =
          post.paymentstatus === "done" ||
          post.invoicePaymentStatus === "paid" ||
          post.invoicePaymentStatus === "partial";
        if (!isPaid) return false;
        const paidDate =
          parseDate(post.paymentDate) || parseDate(post.invoicePaymentDate);
        if (!paidDate) return false;
        if (selectedYear && paidDate.getFullYear() !== Number(selectedYear))
          return false;
        if (selectedMonth && String(paidDate.getMonth() + 1) !== selectedMonth)
          return false;
        return true;
      })
      .reduce((sum, p) => sum + (Number(p.monthlyBudget) || 0), 0);
  }, [data.tuitionPosts, selectedAdminKey, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!selectedAdminKey && data.admins.length) {
      setSelectedAdminKey(data.admins[0].clerkId);
    }
  }, [data.admins, selectedAdminKey]);

  const selectedAdmin = useMemo(() => {
    if (selectedAdminKey === "all") {
      return {
        clerkId: "all",
        name: "All admins",
        role: "",
        isActive: true,
      } as AdminRow;
    }

    return (
      data.admins.find((admin) => admin.clerkId === selectedAdminKey) ??
      data.admins[0]
    );
  }, [data.admins, selectedAdminKey]);

  const selectedAdminStats = useMemo(() => {
    if (selectedAdminKey === "all") {
      const total = adminStats.reduce(
        (acc, a) => {
          acc.tuitionCount += a.tuitionCount;
          acc.tuitionPaidCount += a.tuitionPaidCount;
          acc.jobCount += a.jobCount;
          return acc;
        },
        { tuitionCount: 0, tuitionPaidCount: 0, jobCount: 0 },
      );
      return {
        clerkId: "all",
        name: "All admins",
        role: "",
        isActive: true,
        ...total,
      } as any;
    }

    return (
      adminStats.find((admin) => admin.clerkId === selectedAdminKey) ??
      adminStats[0]
    );
  }, [adminStats, selectedAdminKey]);

  const selectedAdminTuitionPosts = useMemo(() => {
    if (selectedAdminKey === "all") return filteredTuitionPosts;
    return filteredTuitionPosts.filter(
      (post) => post.createdByAdminClerkId === selectedAdminKey,
    );
  }, [filteredTuitionPosts, selectedAdminKey]);

  const selectedAdminJobs = useMemo(() => {
    if (selectedAdminKey === "all") return filteredJobs;
    const selectedAdminId = selectedAdmin?.id;
    if (!selectedAdminId) return [];
    return filteredJobs.filter(
      (job) => job.createdByAdminId === selectedAdminId,
    );
  }, [filteredJobs, selectedAdmin?.id]);

  const adminSelectItems = useMemo(() => {
    return [
      <SelectItem key="all">All admins</SelectItem>,
      ...data.admins.map((admin) => (
        <SelectItem key={admin.clerkId}>{admin.name}</SelectItem>
      )),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.admins]);

  const sourceSelectItems = useMemo(() => {
    return [
      <SelectItem key="all">All sources</SelectItem>,
      ...sourceLists.map((source) => (
        <SelectItem key={source.key}>{source.label}</SelectItem>
      )),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceLists]);

  const referralSelectData = useMemo(() => {
    return [
      { key: "all", label: "All referrers", phone: "", isAll: true },
      ...referralOptions.map((r) => ({
        key: r.key,
        label: r.label,
        phone: r.phone,
        isAll: false,
      })),
    ];
  }, [referralOptions]);

  const savePostPayment = async (
    post: TuitionPostRow,
    nextStatus: "done" | "pending",
    dueDate?: string,
  ) => {
    setSavingPostId(post.postId);
    try {
      const response = await fetch(`/api/v1/posts/${post.postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentstatus: nextStatus,
          paymentDate:
            nextStatus === "done" ? new Date().toISOString() : undefined,
          tentativeDate:
            nextStatus === "pending"
              ? dueDate || post.tentativeDate || undefined
              : dueDate || post.tentativeDate || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error || "Failed to update payment status");

      addToast({ description: "Payment updated", color: "success" });
      await fetchData();
    } catch (error) {
      reportClientError(error, { feature: "admin-payments-dashboard" });
      addToast({
        description:
          error instanceof Error ? error.message : "Failed to update payment",
        color: "danger",
      });
    } finally {
      setSavingPostId(null);
    }
  };

  const defaultDueDate = (createdAt: string) => {
    const date = new Date(createdAt);
    date.setDate(date.getDate() + 3);
    return date.toISOString().slice(0, 10);
  };

  // ── Save payout percentage ───────────────────────────────────────────────
  const savePayoutPercentage = useCallback(
    async (adminClerkId: string) => {
      const pct = Number(payoutPctDraft[adminClerkId]);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        addToast({ description: "Percentage must be 0–100", color: "warning" });
        return;
      }
      setSavingPct(true);
      try {
        const res = await fetch("/api/v1/admin/payments/payout-percentage", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminClerkId, percentage: pct }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Failed to save");
        addToast({ description: "Payout percentage saved", color: "success" });
        await fetchData();
      } catch (err) {
        reportClientError(err, { feature: "admin-payout-percentage" });
        addToast({
          description:
            err instanceof Error ? err.message : "Failed to save percentage",
          color: "danger",
        });
      } finally {
        setSavingPct(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payoutPctDraft],
  );

  // ── Generate payout invoice ──────────────────────────────────────────────
  const generatePayoutInvoice = useCallback(async () => {
    if (!selectedAdminKey || selectedAdminKey === "all") return;
    setGeneratingPayout(true);
    setPayoutLink(null);
    try {
      const res = await fetch("/api/v1/admin/payments/generate-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminClerkId: selectedAdminKey,
          year: Number(selectedYear),
          month: Number(selectedMonth),
        }),
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || "Failed to generate payout");
      const link = `${window.location.origin}/invoices/${payload.invoiceId}`;
      setPayoutLink(link);
      addToast({ description: "Payout invoice generated!", color: "success" });
    } catch (err) {
      reportClientError(err, { feature: "admin-generate-payout" });
      addToast({
        description:
          err instanceof Error ? err.message : "Failed to generate payout",
        color: "danger",
      });
    } finally {
      setGeneratingPayout(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdminKey, selectedYear, selectedMonth]);

  const generateReferralInvoice = useCallback(async () => {
    if (selectedSourceKey !== "referral" || selectedReferralName === "all") {
      return;
    }

    const amount = Number(referralInvoiceAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      addToast({
        description: "Enter a valid invoice amount",
        color: "warning",
      });
      return;
    }

    setGeneratingReferralInvoice(true);
    setReferralInvoiceLink(null);
    try {
      const res = await fetch("/api/v1/admin/payments/generate-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralUserName: selectedReferralName,
          referralPhoneNumber: selectedReferralPhone,
          amount,
          year: Number(selectedYear),
          month: Number(selectedMonth),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to generate referral invoice");
      }
      const link = `${window.location.origin}/invoices/${payload.invoiceId}`;
      setReferralInvoiceLink(link);
      addToast({
        description: "Referral invoice generated!",
        color: "success",
      });
    } catch (err) {
      reportClientError(err, { feature: "admin-referral-invoice" });
      addToast({
        description:
          err instanceof Error
            ? err.message
            : "Failed to generate referral invoice",
        color: "danger",
      });
    } finally {
      setGeneratingReferralInvoice(false);
    }
  }, [
    referralInvoiceAmount,
    selectedReferralName,
    selectedReferralPhone,
    selectedSourceKey,
    selectedYear,
    selectedMonth,
  ]);

  // Render helpers
  const renderAdminsTab = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 sm:px-3 sm:py-2 sm:text-[11px]">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} />
          <span>Period</span>
        </div>
        <span className="font-medium text-slate-900">
          {selectedKey ? monthLabel(selectedKey) : "All dates"}
        </span>
      </div>
      <div className="max-w-md">
        <Select
          label="Admin"
          size="sm"
          selectedKeys={
            selectedAdminKey ? new Set([selectedAdminKey]) : new Set<string>()
          }
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string | undefined;
            setSelectedAdminKey(value ?? data.admins[0]?.clerkId ?? "");
          }}
          className="min-w-0"
          variant="bordered"
        >
          {adminSelectItems}
        </Select>
      </div>

      <Card className="border-none bg-slate-50 shadow-none">
        <CardHeader className="flex  justify-between gap-2 px-2.5 py-2 sm:px-4 sm:py-3">
          {/* <div>
            <p className="text-sm font-semibold text-slate-950">
              {selectedAdmin?.name ?? "Admin"}
            </p>
            <p className="text-[11px] text-slate-500 sm:text-xs">
              {selectedAdmin?.role ?? "Unknown"} ·{" "}
              {selectedAdmin?.isActive ? "Active" : "Inactive"}
            </p>
          </div> */}
          {/* <Chip color="primary" variant="flat" size="sm">
            {(selectedAdminStats?.tuitionCount ?? 0) +
              (selectedAdminStats?.jobCount ?? 0)}{" "}
            records
          </Chip> */}
          <div className="w-full grid grid-cols-4 gap-1.5 text-[10px] sm:gap-2 sm:text-sm">
            <div className="rounded-2xl bg-slate-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-slate-500">Posts</p>
              <p className="text-sm font-semibold text-slate-950 sm:text-base">
                {selectedAdminStats?.tuitionCount ?? 0}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-slate-500">Jobs</p>
              <p className="text-sm font-semibold text-slate-950 sm:text-base">
                {selectedAdminStats?.jobCount ?? 0}
              </p>
            </div>

            <div className="rounded-2xl bg-indigo-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-indigo-700">
                Combined
              </p>
              <p className="text-sm font-semibold text-indigo-900 sm:text-base">
                {(selectedAdminStats?.tuitionCount ?? 0) +
                  (selectedAdminStats?.jobCount ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-emerald-700">Paid</p>
              <p className="text-sm font-semibold text-emerald-900 sm:text-base">
                {selectedAdminStats?.tuitionPaidCount ?? 0}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-3 px-1 pt-0 sm:px-4 sm:pb-4">
          {/* ── Payout Calculator Section ───────────────────────────── */}
          {selectedAdminKey && selectedAdminKey !== "all" && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-linear-to-br from-slate-50 to-indigo-50/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Percent size={14} className="text-indigo-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Payout Calculator
                </p>
              </div>

              {/* Percentage input + save */}
              <div className="flex items-end gap-2">
                <Input
                  label="Payout %"
                  size="sm"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  variant="bordered"
                  className="max-w-35"
                  value={payoutPctDraft[selectedAdminKey] ?? "0"}
                  onValueChange={(v) =>
                    setPayoutPctDraft((prev) => ({
                      ...prev,
                      [selectedAdminKey]: v,
                    }))
                  }
                  endContent={<span className="text-xs text-slate-400">%</span>}
                />
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  isLoading={savingPct}
                  onPress={() => savePayoutPercentage(selectedAdminKey)}
                >
                  Save
                </Button>
              </div>

              {/* Live calculation preview */}
              <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>
                    Total paid tuitions (
                    {selectedAdminStats?.tuitionPaidCount ?? 0})
                  </span>
                  <span className="font-medium text-slate-900">
                    ₹{selectedAdminPaidTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Payout rate</span>
                  <span className="font-medium text-slate-900">
                    {payoutPctDraft[selectedAdminKey] ?? 0}%
                  </span>
                </div>
                <Divider className="my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-slate-700">Estimated payout</span>
                  <span className="text-indigo-700">
                    ₹
                    {(
                      (selectedAdminPaidTotal *
                        Number(payoutPctDraft[selectedAdminKey] ?? 0)) /
                      100
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Generate invoice button */}
              <Button
                size="sm"
                color="secondary"
                variant="solid"
                startContent={<ReceiptText size={14} />}
                isLoading={generatingPayout}
                onPress={generatePayoutInvoice}
                className="w-full"
              >
                Generate Payout Invoice
              </Button>

              {/* Show link after generation */}
              {payoutLink && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                    Shareable payout link
                  </p>
                  <p className="break-all text-[11px] font-mono text-indigo-900">
                    {payoutLink}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      color="secondary"
                      startContent={<Copy size={12} />}
                      onPress={() => {
                        navigator.clipboard.writeText(payoutLink);
                        addToast({
                          description: "Link copied!",
                          color: "success",
                        });
                      }}
                    >
                      Copy link
                    </Button>
                    <Button
                      as={Link}
                      href={payoutLink}
                      target="_blank"
                      size="sm"
                      variant="flat"
                      color="primary"
                      startContent={<ExternalLink size={12} />}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="solid"
                      color="success"
                      className="text-white"
                      startContent={<MessageCircle size={12} />}
                      onPress={() => {
                        const msg = `Here is your payout invoice for ${months[selectedMonth ? parseInt(selectedMonth, 10) - 1 : 0]?.label ?? ""} ${selectedYear}:\n${window.location.origin}${payoutLink}`;
                        shareOnWhatsApp(msg);
                      }}
                    >
                      Share on WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Accordion>
              <AccordionItem key="1" aria-label="Tuitions" title="Tuitions">
                <div className="space-y-2">
                  {selectedAdminTuitionPosts.length ? (
                    selectedAdminTuitionPosts.slice(0, 5).map((post) => (
                      <Card key={post.postId} className="px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">
                              {post.guardianName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatPhone(post.guardianPhone)}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {formatDate(post.createdAt)}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                          <span>
                            {post.paymentstatus === "done" ? "Paid" : "Pending"}
                          </span>
                          <span>{post.monthlyBudget}</span>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <p className="rounded-xl bg-white px-2 py-2 text-sm text-slate-500 shadow-sm">
                      No tuition posts for this admin in the selected period.
                    </p>
                  )}
                </div>
              </AccordionItem>

              <AccordionItem key="2" aria-label="Jobs" title="Jobs">
                <div className="mt-2 space-y-2">
                  {selectedAdminJobs.length ? (
                    selectedAdminJobs.slice(0, 5).map((job) => (
                      <div
                        key={job.jobId}
                        className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">
                              {job.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {job.clientName}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {formatDate(job.createdAt)}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                          <span>{job.status ?? "Open"}</span>
                          <span>{formatPhone(job.phoneNumber)}</span>
                        </div>
                        {job.referralUserName ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                            <span>Referral</span>
                            <span className="h-1 w-1 rounded-full bg-amber-400" />
                            <span>{job.referralUserName}</span>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                      No jobs for this admin in the selected period.
                    </p>
                  )}
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderSourceTab = () => (
    <div className="space-y-3">
      <p className="hidden max-w-3xl text-xs text-slate-500 sm:block">
        Choose a source from the dropdown to inspect its tuition and job
        activity.
      </p>
      <div className="flex w-full gap-2">
        <Select
          label="Source"
          size="sm"
          selectedKeys={
            selectedSourceKey ? new Set([selectedSourceKey]) : new Set<string>()
          }
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string | undefined;
            setSelectedSourceKey(value ?? sourceLists[0]?.key ?? "other");
          }}
          className="min-w-0"
          variant="bordered" 
        >
          {sourceSelectItems}
        </Select>


        {selectedSourceKey === "referral" && (
          <Select
            label="Referrer"
            size="sm"
            items={referralSelectData}
            selectedKeys={
              selectedReferralKey
                ? new Set([selectedReferralKey])
                : new Set<string>()
            }
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              if (!value || value === "all") {
                setSelectedReferralKey("all");
                setSelectedReferralName("all");
                setSelectedReferralPhone("");
                return;
              }

              const referral = referralOptions.find(
                (item) => item.key === value,
              );
              setSelectedReferralKey(value);
              setSelectedReferralName(referral?.label ?? "all");
              setSelectedReferralPhone(referral?.phone ?? "");
            }}
            className="min-w-0"
            variant="bordered"
          >
            {(item) => (
              <SelectItem key={item.key}>
                {item.isAll
                  ? "All referrers"
                  : item.phone
                    ? `${item.label} • ${item.phone}`
                    : `${item.label}`}
              </SelectItem>
            )}
          </Select>
        )}
      </div>

      {selectedSourceKey === "referral" && selectedReferralName !== "all" && (
        <Card className="border border-dashed border-slate-200 bg-linear-to-br from-slate-50 to-indigo-50/25 shadow-none max-w-md">
          <CardBody className="space-y-3 p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Referral Invoice
              </p>
              <p className="text-sm font-medium text-slate-900">
                {selectedReferralName}
              </p>
              {selectedReferralPhone ? (
                <p className="text-[11px] text-slate-500">
                  {formatPhone(selectedReferralPhone)}
                </p>
              ) : null}
              <p className="text-[11px] text-slate-500">
                Enter the amount you want to invoice for this referrer.
              </p>
            </div>

            <div className="flex items-end gap-2">
              <Input
                label="Invoice amount"
                size="sm"
                type="number"
                min={0}
                step={0.01}
                variant="bordered"
                className="max-w-35"
                value={referralInvoiceAmount}
                onValueChange={setReferralInvoiceAmount}
                endContent={<span className="text-xs text-slate-400">₹</span>}
              />
              <Button
                size="sm"
                color="secondary"
                variant="solid"
                startContent={<ReceiptText size={14} />}
                isLoading={generatingReferralInvoice}
                onPress={generateReferralInvoice}
              >
                Generate Invoice
              </Button>
            </div>

            {referralInvoiceLink && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                  Shareable invoice link
                </p>
                <p className="break-all text-[11px] font-mono text-indigo-900">
                  {referralInvoiceLink}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    startContent={<Copy size={12} />}
                    onPress={() => {
                      navigator.clipboard.writeText(referralInvoiceLink);
                      addToast({
                        description: "Link copied!",
                        color: "success",
                      });
                    }}
                  >
                    Copy link
                  </Button>
                  <Button
                    as={Link}
                    href={referralInvoiceLink}
                    target="_blank"
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<ExternalLink size={12} />}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="solid"
                    color="success"
                    className="text-white"
                    startContent={<MessageCircle size={12} />}
                    onPress={() => {
                      const msg = `Here is your referral invoice for ${monthLabel(selectedKey)}:\n${window.location.origin}${referralInvoiceLink}`;
                      shareOnWhatsApp(msg);
                    }}
                  >
                    Share on WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="border border-slate-200/70 shadow-none">
        <CardHeader className="flex items-start justify-between gap-2 px-2.5 py-2 sm:px-4 sm:py-3">
          {/* <div>
            <p className="text-sm font-semibold text-slate-950">
              {selectedSource?.label ?? "Source"}
            </p>
            <p className="text-[11px] text-slate-500 sm:text-xs">
              Source key: {selectedSourceKey}
            </p>
          </div>
          <Chip variant="flat" color="secondary" size="sm">
            {selectedSourceStats.tuitionCount + selectedSourceStats.jobCount}{" "}
            records
          </Chip> */}
          <div className="w-full grid grid-cols-3 gap-1.5 text-[10px] sm:gap-2 sm:text-sm">
            <div className="rounded-2xl bg-slate-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-slate-500">Tuition</p>
              <p className="text-sm font-semibold text-slate-950 sm:text-base">
                {selectedSourceStats.tuitionCount}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-slate-500">Jobs</p>
              <p className="text-sm font-semibold text-slate-950 sm:text-base">
                {selectedSourceStats.jobCount}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-2 text-center sm:p-3">
              <p className="uppercase tracking-wide text-emerald-700">
                Combined
              </p>
              <p className="text-sm font-semibold text-emerald-900 sm:text-base">
                {selectedSourceStats.tuitionCount +
                  selectedSourceStats.jobCount}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-3 px-2.5 pt-0 sm:px-4 sm:pb-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tuition posts
              </p>
              <div className="mt-2 space-y-2">
                {selectedSourceTuitionPosts.length ? (
                  selectedSourceTuitionPosts.slice(0, 5).map((post) => (
                    <div
                      key={post.postId}
                      className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">
                            {post.postId} | {post.guardianName}
                          </p>
                          {post.source === "referral" ? (
                            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                              <span>Referral</span>
                              <span className="h-1 w-1 rounded-full bg-amber-400" />
                              <span>
                                {post.referralUserName ?? "No referral"}
                              </span>
                            </div>
                          ) : null}
                          <p className="text-[11px] text-slate-500">
                            {formatPhone(post.guardianPhone)}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(post.createdAt)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                        {/* <span>
                          {post.paymentstatus === "done" ? "Paid" : "Pending"}
                        </span> */}
                        <span>{post.monthlyBudget}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                    No tuition posts for this source in the selected period.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Jobs
              </p>
              <div className="mt-2 space-y-2">
                {selectedSourceJobs.length ? (
                  selectedSourceJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.jobId}
                      className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">
                            {job.jobId} | {job.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {job.clientName}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(job.createdAt)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                        {/* <span>{job.status ?? "Open"}</span> */}
                        <span>{formatPhone(job.phoneNumber)}</span>
                      </div>
                      {job.referralUserName ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                          <span>Referral</span>
                          <span className="h-1 w-1 rounded-full bg-amber-400" />
                          <span>{job.referralUserName}</span>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                    No jobs for this source in the selected period.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderPostsTab = () => {
    const postsList = [
      ...filteredTuitionPosts.map((post) => {
        const isPaid = isTuitionPaid(post);
        return {
          kind: "tuition" as const,
          id: post.postId,
          title: post.guardianName,
          subtitle: formatPhone(post.guardianPhone),
          source: post.source,
          createdAt: post.createdAt,
          tuitionFee: post.monthlyBudget,
          statusLabel: "Payment status",
          statusValue: isPaid ? "Paid" : "Pending",
          invoiceId: post.invoiceId,
          invoiceGenerated: post.invoiceGenerated,
          isPaid,
        };
      }),
      ...filteredJobs.map((job) => {
        const isPaid = isJobPaid(job);
        return {
          kind: "job" as const,
          id: job.jobId,
          title: job.title,
          subtitle: job.clientName,
          source: job.source,
          createdAt: job.createdAt,
          tuitionFee: undefined,
          statusLabel: "Status",
          statusValue: job.status ?? "Open",
          invoiceId: job.invoiceId,
          invoiceGenerated: job.invoiceGenerated,
          isPaid,
        };
      }),
    ];

    const displayedPosts = postsList.filter((post) =>
      postStatusTab === "paid" ? post.isPaid : !post.isPaid,
    );

    return (
      <div className="space-y-2.5">
        <div className="flex justify-center rounded-2xl bg-slate-50 p-2">
          <Tabs
            aria-label="Post payment status"
            color="primary"
            selectedKey={postStatusTab}
            variant="underlined"
            onSelectionChange={(key) => setPostStatusTab(key as PostStatusTabKey)}
            classNames={{ tabList: "gap-2 w-full", cursor: "w-full" }}
            style={{ width: "100%" }}
          >
            <Tab
              key="paid"
              title={
                <div className="inline-flex items-center gap-2">
                  <span>Paid</span>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {postStatusCounts.paid}
                  </span>
                </div>
              }
            />
            <Tab
              key="unpaid"
              title={
                <div className="inline-flex items-center gap-2">
                  <span>Unpaid</span>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                    {postStatusCounts.unpaid}
                  </span>
                </div>
              }
            />
          </Tabs>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
          {displayedPosts.map((post) => (
            <Card
              key={`${post.kind}-${post.id}`}
              className="border border-slate-200/70 shadow-none"
            >
              <CardHeader className="flex items-start justify-between gap-2 px-2.5 py-2 sm:px-4 sm:py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-950">
                      {post.title}
                    </p>
                    <Chip size="sm" variant="flat" color="default">
                      {post.kind === "tuition" ? "Tuition" : "Job"}
                    </Chip>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">
                    {post.id}
                  </p>
                  <p className="text-[11px] text-slate-500 sm:text-xs">
                    {post.subtitle}
                  </p>
                </div>
                <Chip
                  color={
                    post.kind === "tuition"
                      ? post.statusValue === "Paid"
                        ? "success"
                        : "warning"
                      : "secondary"
                  }
                  size="sm"
                  variant="flat"
                >
                  {post.statusValue}
                </Chip>
              </CardHeader>
              <CardBody className="space-y-2 px-2.5 pt-0 sm:px-4 sm:pb-4">
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                  <span>
                    {post.kind === "tuition" ? "Tuition fee" : "Job status"}:{" "}
                    {post.kind === "tuition"
                      ? post.tuitionFee
                      : post.statusValue}
                  </span>
                  <span>
                    {post.createdAt ? formatDate(post.createdAt) : "—"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Chip variant="flat" color="primary" size="sm">
                    {sourceLists.find((s) => s.key === post.source)?.label ??
                      post.source ??
                      "Unknown"}
                  </Chip>
                </div>

                {post.invoiceGenerated && post.invoiceId ? (
                  <Link
                    href={`/invoices/${post.invoiceId}`}
                    className="inline-flex w-fit items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    Open invoice
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>

        {displayedPosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No {postStatusTab} posts found for the selected period.
          </div>
        )}
      </div>
    );
  };

  const content = loading ? (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  ) : activeTab === "admins" ? (
    renderAdminsTab()
  ) : activeTab === "source" ? (
    renderSourceTab()
  ) : (
    renderPostsTab()
  );

  return (
    <div className="px-2 py-2 sm:px-4 sm:py-6 space-y-6">
      <>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-medium text-white">
              <BadgeIndianRupee size={14} />
              Payment Control Center
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Manage payments
            </h1>
            <p className="hidden max-w-3xl text-sm text-slate-600 sm:block sm:text-base">
              Track how much each admin handled, inspect source-wise records,
              and settle tuition post payments from one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Select
              label="Year"
              size="sm"
              selectedKeys={
                selectedYear ? new Set([selectedYear]) : new Set<string>()
              }
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setSelectedYear(value ?? "");
              }}
              className="min-w-0"
              variant="bordered"
            >
              {yearOptions(6).map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>

            <Select
              label="Month"
              size="sm"
              selectedKeys={
                selectedMonth ? new Set([selectedMonth]) : new Set<string>()
              }
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setSelectedMonth(value ?? "");
              }}
              className="min-w-0"
              variant="bordered"
            >
              {months.map((m) => (
                <SelectItem key={m.key}>{m.label}</SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-2 grid-cols-4 sm:grid-cols-4">
          <Card className="border border-slate-200/70 bg-teal-500  shadow-none">
            <CardBody className="gap-1.5 p-3">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Users size={14} />
                Admins
              </div>
              <p className="text-xl font-black">{data.admins.length}</p>
            </CardBody>
          </Card>
          <Card className="border border-slate-200/70 shadow-none">
            <CardBody className="gap-1.5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Layers3 size={14} />
                Tuition
              </div>
              <p className="text-xl font-black text-slate-950">
                {filteredTuitionPosts.length}
              </p>
            </CardBody>
          </Card>
          <Card className="border border-slate-200/70 shadow-none">
            <CardBody className="gap-1.5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck size={14} />
                Jobs
              </div>
              <p className="text-xl font-black text-slate-950">
                {filteredJobs.length}
              </p>
            </CardBody>
          </Card>
          <Card className="border border-slate-200/70 bg-emerald-50 shadow-none">
            <CardBody className="gap-1.5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                <ShieldCheck size={14} />
                Paid
              </div>
              <p className="text-xl font-black text-emerald-900">
                {
                  data.tuitionPosts.filter((post) => {
                    const isPaid =
                      post.paymentstatus === "done" ||
                      post.invoicePaymentStatus === "paid" ||
                      post.invoicePaymentStatus === "partial";
                    if (!isPaid) return false;
                    const paidDate =
                      parseDate(post.paymentDate) ||
                      parseDate(post.invoicePaymentDate);
                    if (!paidDate) return false;
                    if (
                      selectedYear &&
                      paidDate.getFullYear() !== Number(selectedYear)
                    )
                      return false;
                    if (
                      selectedMonth &&
                      String(paidDate.getMonth() + 1) !== selectedMonth
                    )
                      return false;
                    return true;
                  }).length
                }
              </p>
            </CardBody>
          </Card>
        </div>
      </>

      <Card>
        <div className="flex justify-between gap-2 border-b border-slate-200/70 p-2 sm:flex-row sm:items-center sm:justify-between sm:p-3">
          <Tabs
            aria-label="Payment dashboard views"
            color="primary"
            selectedKey={activeTab}
            variant="underlined"
            onSelectionChange={(key) => setActiveTab(key as TabKey)}
            classNames={{ tabList: "gap-2", cursor: "w-full" }}
          >
            <Tab key="admins" title="Admins" />
            <Tab key="source" title="Source" />
            <Tab key="post" title="Post" />
          </Tabs>
          <Button
            isIconOnly
            size="md"
            variant="flat"
            startContent={<RefreshCw size={15} />}
            onPress={fetchData}
          ></Button>
        </div>

        <Divider />

        <div className="p-2 sm:p-4">{content}</div>
      </Card>
    </div>
  );
}
