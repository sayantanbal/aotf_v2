"use client";

import { formatDisplayDateTime } from "@/lib/utils/display-date";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import BackButton from "@/components/BackButton";
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  GraduationCap,
  Phone,
  MapPin,
  CalendarDays,
  Clock,
  BadgeCheck,
  Search,
  ExternalLink,
  ScanLine,
} from "lucide-react";
import { FaChalkboardTeacher } from "react-icons/fa";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { reportClientError } from "@/lib/client-report-error";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifiedPerson {
  role: "teacher" | "candidate";
  username?: string;
  name: string;
  bio?: string | null;
  photo: string;
  qualification?: string;
  subjects?: string[];
  employeeId: string;
  phone: string;
  location?: string | null;
  joinDate: string;
  expiryDate: string;
  isVerified: boolean;
  plan?: string;
  status: "active" | "expired" | "suspended" | "in_progress";
  profileUrl?: string;
}

type VerifyState =
  | { kind: "loading" }
  | { kind: "verified"; person: VerifiedPerson }
  | { kind: "expired"; person: VerifiedPerson }
  | { kind: "suspended"; person: VerifiedPerson }
  | { kind: "not_found" }
  | { kind: "in_progress"; person: VerifiedPerson }
  | { kind: "error"; message: string };

function maskPhoneForPublicView(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed || trimmed === "—") return "—";
  if (/x/i.test(trimmed)) return trimmed;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length < 3) return "—";

  const localNumber = digitsOnly.slice(-10);
  const countryDigits = digitsOnly.slice(0, -10);
  const countryCode = countryDigits ? `+${countryDigits}` : "+91";

  return `${countryCode} ${"X".repeat(Math.max(localNumber.length - 3, 0))}${localNumber.slice(-3)}`;
}

// ─── Gradient + color maps ────────────────────────────────────────────────────

const roleGradient: Record<string, string> = {
  teacher: "from-indigo-600 via-blue-600 to-cyan-500",
  candidate: "from-emerald-600 via-teal-600 to-cyan-500",
};

const roleBadge: Record<string, { bg: string; label: string }> = {
  teacher: { bg: "bg-indigo-100 text-indigo-700", label: "Faculty" },
  candidate: { bg: "bg-emerald-100 text-emerald-700", label: "Candidate" },
};

const statusConfig: Record<
  string,
  {
    icon: typeof ShieldCheck;
    color: string;
    bg: string;
    label: string;
    description: string;
  }
> = {
  active: {
    icon: ShieldCheck,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    label: "Verified & Active",
    description:
      "This profile is valid and the holder is an active member of Academy of Tutorials and Freelancers.",
  },
  expired: {
    icon: ShieldAlert,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    label: "Expired",
    description:
      "This profile has expired. The holder was previously a member but needs to renew.",
  },
  suspended: {
    icon: ShieldX,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    label: "Suspended",
    description:
      "This profile has been suspended. Please contact AOTF for more information.",
  },
  in_progress: {
    icon: Clock,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    label: "Verification in Progress",
    description:
      "This profile is currently under review.",
  },
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function VerifyPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const [state, setState] = useState<VerifyState>({ kind: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ kind: "not_found" });
      return;
    }

    let cancelled = false;

    async function verify() {
      setState({ kind: "loading" });

      // Try API first
      try {
        const res = await fetch(`/api/v1/verify/${encodeURIComponent(id)}`);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            const person: VerifiedPerson = data.person;
            if (person.status === "expired") {
              setState({ kind: "expired", person });
            } else if (person.status === "suspended") {
              setState({ kind: "suspended", person });
            } else if (person.status === "in_progress") {
              setState({ kind: "in_progress", person });
            } else {
              setState({ kind: "verified", person });
            }
            return;
          }
          if (res.status === 404) {
            // Fall through to sample data
            setState({ kind: "not_found" });
          } else {
            // Fall through to sample data
            setState({ kind: "not_found" });
          }
        }
      } catch (error) {
        // API unavailable — fall through to sample data
        reportClientError(error, { feature: "credential-verification-lookup" });
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="w-full min-h-[70vh]">
      <BackButton title="ID Card Verification" />

      <div className="max-w-md mx-auto px-2 pb-8">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-sm text-default-500 mt-1">
            {siteConfig.name} — Official Verification Portal
          </p>
        </div>

        {/* Queried ID chip */}
        {id && (
          <div className="flex justify-center mb-5">
            <Chip
              variant="bordered"
              size="sm"
              className="font-mono text-xs tracking-wider"
            >
              ID: {id}
            </Chip>
          </div>
        )}

        {/* ─── Loading ─── */}
        {state.kind === "loading" && (
          <Card className="p-8">
            <CardBody className="flex flex-col items-center gap-3">
              <Spinner size="lg" color="primary" />
              <p className="text-sm text-default-500">Verifying ID card…</p>
            </CardBody>
          </Card>
        )}

        {/* ─── Not found ─── */}
        {state.kind === "not_found" && <NotFoundCard id={id} />}

        {/* ─── Error ─── */}
        {state.kind === "error" && (
          <Card className="border border-red-200 dark:border-red-800">
            <CardBody className="flex flex-col items-center gap-3 p-6 text-center">
              <ShieldX size={48} className="text-red-400" />
              <h2 className="text-lg font-bold text-red-600">
                Verification Error
              </h2>
              <p className="text-sm text-default-500">{state.message}</p>
            </CardBody>
          </Card>
        )}

        {/* ─── Verified / Expired / Suspended / In Progress ─── */}
        {(state.kind === "verified" ||
          state.kind === "expired" ||
          state.kind === "suspended" ||
          state.kind === "in_progress") && (
          <VerificationResult person={state.person} />
        )}

        {/* Scan another */}
        <div className="flex justify-center mt-5">
          <Button
            as={Link}
            href="/verify"
            variant="bordered"
            size="sm"
            startContent={<ScanLine size={14} />}
          >
            Scan Another QR Code
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-default-400 mt-6 leading-relaxed">
          This verification is provided by {siteConfig.name}.
          <br />
          If you suspect misuse, contact us at{" "}
          <a href={`mailto:${siteConfig.contact.email}`} className="underline">
            {siteConfig.contact.email}
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Not Found Card ───────────────────────────────────────────────────────────

function NotFoundCard({ id }: { id: string }) {
  return (
    <Card className="border border-red-200 dark:border-red-800 overflow-hidden">
      {/* Red banner */}
      <div className="bg-linear-to-br from-red-500 to-rose-500 px-5 py-4 flex items-center gap-3">
        <ShieldX size={28} className="text-white" />
        <div>
          <p className="text-white font-bold text-sm">Not Found</p>
          <p className="text-white/70 text-xs">No matching record exists</p>
        </div>
      </div>

      <CardBody className="p-5 space-y-3 text-center">
        <p className="text-sm text-default-600">
          The ID{" "}
          <span className="font-mono font-semibold text-default-900">
            {id || "—"}
          </span>{" "}
          does not match any teacher or candidate in our system.
        </p>

        <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl p-3 text-xs text-red-600 dark:text-red-400 space-y-1">
          <p className="font-semibold">⚠️ This ID card may be fraudulent</p>
          <p>
            If someone presented this card to you, please do not trust it.
            Report it to AOTF immediately.
          </p>
        </div>

        <Button
          as={Link}
          href={`mailto:${siteConfig.contact.email}?subject=Suspicious ID: ${id}`}
          variant="flat"
          color="danger"
          size="sm"
          className="mt-2"
        >
          Report This ID
        </Button>
      </CardBody>
    </Card>
  );
}

// ─── Verification Result Card ─────────────────────────────────────────────────

function VerificationResult({ person }: { person: VerifiedPerson }) {
  const sc = statusConfig[person.status];
  const StatusIcon = sc.icon;
  const badge = roleBadge[person.role] ?? roleBadge.teacher;
  const gradient = roleGradient[person.role] ?? roleGradient.teacher;

  return (
    <div className="space-y-4">
      {/* ── Status banner ── */}
      <Card className={`border ${sc.bg} overflow-hidden`}>
        <div
          className={`bg-linear-to-br ${gradient} px-5 py-3 flex items-center gap-3`}
        >
          <img
            src="/AOTF.svg"
            alt="AOTF"
            className="w-8 h-8 rounded-lg bg-white p-0.5"
          />
          <div>
            <p className="text-white font-bold text-sm tracking-wide">
              {siteConfig.name}
            </p>
            <p className="text-[10px] text-white/70 tracking-widest uppercase">
              Verification Result
            </p>
          </div>
        </div>

        <CardBody className="p-5">
          {/* Status icon + label */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                person.status === "active"
                  ? "bg-green-100 dark:bg-green-900/30"
                  : person.status === "expired"
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : person.status === "suspended"
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-blue-100 dark:bg-blue-900/30"
              }`}
            >
              <StatusIcon size={24} className={sc.color} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${sc.color}`}>{sc.label}</h2>
              <p className="text-xs text-default-500">{sc.description}</p>
            </div>
          </div>

          {/* Timestamp */}
          {person.status !== "in_progress" && (
            <div className="flex items-center gap-1.5 text-[10px] text-default-400 mb-1">
            <Clock size={10} />
            <span>
              Verified on{" "}
              {formatDisplayDateTime(new Date())}
            </span>
          </div>
          )}
        </CardBody>
      </Card>

      {/* ── Person details ── */}
      <Card className="overflow-hidden">
        <CardBody className="p-0">
          {/* Photo + name header */}
          <div className="flex items-center gap-3 p-4 pb-3">
            <div className="shrink-0 rounded-xl overflow-hidden ring-2 ring-default-200 shadow-md">
              <img
                src={person.photo}
                alt={person.name}
                className="w-16 h-16 object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-default-900 truncate">
                  {person.name}
                </h3>
                {person.isVerified && (
                  <BadgeCheck size={16} className="text-blue-500 shrink-0" />
                )}
              </div>
              {person.bio && (
                <p className="text-xs text-default-500 truncate">
                  {person.bio}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <Chip
                  size="sm"
                  variant="flat"
                  className={`text-[10px] font-semibold uppercase ${badge.bg}`}
                >
                  {badge.label}
                </Chip>
                {person.plan && (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="success"
                    className="text-[10px] uppercase font-semibold"
                  >
                    {person.plan}
                  </Chip>
                )}
              </div>
            </div>
          </div>

          <Divider />

          {/* Detail rows */}
          <div className="p-4 space-y-2.5 text-sm">
            {/* Employee ID */}
            <DetailRow
              icon={<Search size={14} className="text-default-400" />}
              label="ID"
              value={
                <span className="font-mono font-semibold tracking-wide">
                  {person.employeeId}
                </span>
              }
            />

            {/* Qualification */}
            {person.qualification && (
              <DetailRow
                icon={<GraduationCap size={14} className="text-default-400" />}
                label="Qualification"
                value={person.qualification}
              />
            )}

            {/* Subjects */}
            {person.subjects && person.subjects.length > 0 && (
              <div className="flex items-start gap-2.5">
                <FaChalkboardTeacher
                  size={14}
                  className="text-default-400 shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[10px] text-default-400 uppercase font-medium mb-1">
                    Subjects
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {person.subjects.map((s) => (
                      <Chip
                        key={s}
                        size="sm"
                        variant="flat"
                        className="text-[10px]"
                      >
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Contact */}
            <DetailRow
              icon={<Phone size={14} className="text-default-400" />}
              label="Phone"
              value={maskPhoneForPublicView(person.phone)}
            />

            {person.location && (
              <DetailRow
                icon={<MapPin size={14} className="text-default-400" />}
                label="Location"
                value={person.location}
              />
            )}

            {person.username && (
              <DetailRow
                icon={<ExternalLink size={14} className="text-default-400" />}
                label="Username"
                value={`@${person.username}`}
              />
            )}

            {/* Account opened date */}
            <DetailRow
              icon={<CalendarDays size={14} className="text-default-400" />}
              label="From"
              value={person.joinDate}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Detail row helper ────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-default-400 uppercase font-medium">
          {label}
        </p>
        <p className="text-sm text-default-700 wrap-break-word">{value}</p>
      </div>
    </div>
  );
}
