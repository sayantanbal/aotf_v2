"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  BookOpen,
  IndianRupee,
  ShieldCheck,
  Star,
  ArrowUpRight,
  TrendingUp,
  Clock,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SuperAdminPayload {
  role: "super_admin";
  stats: {
    totalUsers: number;
    activePosts: number;
    enquiries: { new: number; inProgress: number; total: number };
    revenue: number;
    admins: Record<string, number>;
    feedbacks: { total: number; open: number };
    postsThisMonth: {
      total: number;
      paid: number;
      unpaid: number;
    };
    approvedPostsThisMonth: {
      approved: number;
      ongoing: number;
      cancelled: number;
    };
    usersThisMonth: {
      total: number;
      growthPct: number;
      blocked: number;
    };
    revenueThisMonth: Array<{ currency: string; total: number }>;
  };
  postsByStatus: Record<string, number>;
  recentPayments: Array<{
    _id: string;
    amount: number;
    purpose: string;
    status: string;
    paidAt?: string;
    createdAt: string;
  }>;
  recentEnquiries: Array<{
    _id: string;
    name: string;
    query: string;
    currentStatus: string;
    createdAt: string;
  }>;
  revenueTrend: Array<{ _id: string; total: number }>;
  recentAuditLog: Array<{
    _id: string;
    adminUsername: string;
    action: string;
    targetType?: string;
    targetIdentifier?: string;
    createdAt: string;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function fmtCurrency(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300",
  matched:
    "bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300",
  closed:
    "bg-zinc-100   text-zinc-600   dark:bg-zinc-800      dark:text-zinc-400",
  cancelled:
    "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300",
  hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  new: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  in_progress:
    "bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300",
  contacted:
    "bg-cyan-100   text-cyan-700   dark:bg-cyan-900/40   dark:text-cyan-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  paid: "bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300",
  failed:
    "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`relative rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-shadow hover:shadow-md overflow-hidden group`}
    >
      {/* accent blob */}
      <div
        className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 ${accent}`}
      />
      <div
        className={`mb-3 inline-flex items-center justify-center w-10 h-10 rounded-xl ${accent} bg-opacity-15`}
      >
        <Icon size={18} className="text-inherit opacity-80" />
      </div>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
        {label}
      </p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {sub}
        </p>
      )}
      {href && (
        <ArrowUpRight
          size={14}
          className="absolute bottom-4 right-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors"
        />
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Revenue Sparkline (inline SVG) ─────────────────────────────────────────

function RevenueTrend({
  data,
}: {
  data: Array<{ _id: string; total: number }>;
}) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-zinc-400">
        No revenue data for the last 30 days
      </div>
    );
  }

  const W = 600;
  const H = 120;
  const PAD = 8;
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - (d.total / maxVal) * (H - PAD * 2);
    return { x, y, total: d.total, date: d._id };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `${points[0].x},${H}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${H}`,
  ].join(" ");

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-28"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#revGrad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-zinc-400 mt-1 px-1">
        <span>{data[0]._id}</span>
        <span>{data[data.length - 1]._id}</span>
      </div>
    </div>
  );
}

// ─── Section Card wrapper ────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {action.label} <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SuperAdminDashboard({
  data,
}: {
  data: SuperAdminPayload;
}) {
  const {
    stats,
    postsByStatus,
    recentPayments,
    recentEnquiries,
    revenueTrend,
    recentAuditLog,
  } = data;

  const totalAdmins = Object.values(stats.admins).reduce((a, b) => a + b, 0);
  const adminSubLabel = Object.entries(stats.admins)
    .map(([role, count]) => `${count} ${role.replace("_", " ")}`)
    .join(" · ");

  const monthlyRevenue =
    stats.revenueThisMonth.length > 0
      ? stats.revenueThisMonth
          .map(({ currency, total }) => fmtCurrency(total, currency))
          .join(" · ")
      : fmtCurrency(0, "INR");

  const growthPct = stats.usersThisMonth.growthPct;
  const sign = growthPct > 0 ? "+" : "";
  const userSub = `${sign}${growthPct.toFixed(1)}% vs last month · ${stats.usersThisMonth.blocked} blocked`;

  return (
    <div className="space-y-8">
      {/* ── Stat Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Posts This Month"
          value={fmt(stats.postsThisMonth.total)}
          sub={`${stats.postsThisMonth.paid} paid · ${stats.postsThisMonth.unpaid} unpaid`}
          accent="bg-indigo-500"
          href="/admin/tuitions"
        />
        <StatCard
          icon={TrendingUp}
          label="Approved Posts"
          value={fmt(stats.approvedPostsThisMonth.approved)}
          sub={`${stats.approvedPostsThisMonth.ongoing} ongoing · ${stats.approvedPostsThisMonth.cancelled} cancelled`}
          accent="bg-green-500"
          href="/admin/tuitions"
        />
        <StatCard
          icon={Users}
          label="Registered Users"
          value={fmt(stats.usersThisMonth.total)}
          sub={userSub}
          accent="bg-blue-500"
          href="/admin/users"
        />
        <StatCard
          icon={Star}
          label="Feedbacks"
          value={fmt(stats.feedbacks.total)}
          sub={`${stats.feedbacks.open} open / unresolved`}
          accent="bg-pink-500"
          href="/admin/feedbacks"
        />
        <StatCard
          icon={IndianRupee}
          label="Total Revenue"
          value={monthlyRevenue}
          accent="bg-emerald-500"
          href="/admin/payments"
        />
        <StatCard
          icon={ShieldCheck}
          label="Total Admins"
          value={fmt(totalAdmins)}
          sub={adminSubLabel}
          accent="bg-purple-500"
          href="/admin/settings"
        />
      </div>

      {/* ── Revenue Trend + Posts by Status ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Revenue Trend — Last 30 Days">
            <RevenueTrend data={revenueTrend} />
          </Section>
        </div>
        <Section title="Posts by Status">
          <div className="space-y-3">
            {Object.entries(postsByStatus).length === 0 ? (
              <p className="text-sm text-zinc-400">No posts yet</p>
            ) : (
              Object.entries(postsByStatus).map(([status, count]) => {
                const total =
                  Object.values(postsByStatus).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={status} />
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                        {fmt(count)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Section>
      </div>

      {/* ── Recent Payments + Recent Enquiries ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Recent Payments"
          action={{ label: "View all", href: "/admin/payments" }}
        >
          <div className="space-y-3">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-zinc-400">No payments yet</p>
            ) : (
              recentPayments.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 capitalize">
                      {p.purpose.replace("_", " ")}
                    </p>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />{" "}
                      {relativeTime(p.paidAt ?? p.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {fmtCurrency(p.amount / 100, "INR")}
                    </p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section
          title="Recent Enquiries"
          action={{ label: "View all", href: "/admin/enquiries" }}
        >
          <div className="space-y-3">
            {recentEnquiries.length === 0 ? (
              <p className="text-sm text-zinc-400">No enquiries yet</p>
            ) : (
              recentEnquiries.map((e) => (
                <div
                  key={e._id}
                  className="flex items-start justify-between py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                      {e.name}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {e.query}
                    </p>
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {relativeTime(e.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={e.currentStatus} />
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      {/* ── Audit Log ── */}
      <Section
        title="Recent Admin Activity"
        action={{ label: "View audit log", href: "/admin/settings" }}
      >
        <div className="space-y-2">
          {recentAuditLog.length === 0 ? (
            <p className="text-sm text-zinc-400">No audit log entries yet</p>
          ) : (
            recentAuditLog.map((log) => (
              <div
                key={log._id}
                className="flex items-center gap-3 py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">{log.adminUsername}</span>{" "}
                    <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {log.action}
                    </span>
                    {log.targetIdentifier && (
                      <span className="text-zinc-500">
                        {" "}
                        → {log.targetIdentifier}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-zinc-400 shrink-0 flex items-center gap-1">
                  <Clock size={10} /> {relativeTime(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
