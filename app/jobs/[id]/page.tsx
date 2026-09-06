import { Button } from "@heroui/button";
import { Card, CardHeader } from "@heroui/card";
import { User } from "@heroui/user";
import { LuNotebookText } from "react-icons/lu";
import { SlShare } from "react-icons/sl";
import {
  FaMapMarkerAlt,
  FaUserAlt,
  FaBuilding,
  FaBriefcase,
  FaSuitcase,
} from "react-icons/fa";
import { BsCurrencyRupee } from "react-icons/bs";
import { FaClock, FaCode } from "react-icons/fa6";
import {
  MdOutlineWifiTethering,
  MdOutlineStorefront,
  MdCardTravel,
} from "react-icons/md";
import { TbReportMoney } from "react-icons/tb";
import ApplyActionButton from "@/components/ApplyActionButton";
import BackButton from "@/components/BackButton";
import { getJobByJobId } from "@/lib/services/job.service";
import { notFound } from "next/navigation";

/* ─── Helpers ─────────────────────────────────────────────────── */

const getStatusBadge = (status: string) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    open: {
      bg: "bg-green-100 dark:bg-green-900/40",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-700 dark:text-green-300",
    },
    hold: {
      bg: "bg-yellow-100 dark:bg-yellow-900/40",
      border: "border-yellow-200 dark:border-yellow-800",
      text: "text-yellow-700 dark:text-yellow-300",
    },
    closed: {
      bg: "bg-red-100 dark:bg-red-900/40",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
    },
    cancelled: {
      bg: "bg-red-100 dark:bg-red-900/40",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
    },
  };
  return colors[status] ?? colors.open;
};

const getLocationIcon = (type: string) => {
  switch (type) {
    case "remote":
      return {
        icon: <MdOutlineWifiTethering size={30} className="text-primary" />,
        label: "Remote",
      };
    case "hybrid":
      return {
        icon: <MdOutlineStorefront size={30} className="text-primary" />,
        label: "Hybrid",
      };
    default:
      return {
        icon: <FaMapMarkerAlt size={28} className="text-primary" />,
        label: "On-Site",
      };
  }
};

const getWorkTypeIcon = (type: string) => {
  switch (type) {
    case "project":
      return {
        icon: <FaBriefcase size={28} className="text-primary" />,
        label: "Project",
      };
    default:
      return {
        icon: <FaBuilding size={28} className="text-primary" />,
        label: "Full-Time Job",
      };
  }
};

const formatCommissionBasis = (basis: string) => {
  switch (basis) {
    case "first_month":
      return "First Month Salary";
    case "project_value":
      return "Project Value";
    default:
      return basis;
  }
};

const formatSource = (source: string) =>
  source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ─── Reusable row ────────────────────────────────────────────── */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
      <span className="text-gray-500 dark:text-gray-400 text-sm">{label}</span>
      <span className="text-gray-900 dark:text-white font-medium text-sm text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let job;
  try {
    job = await getJobByJobId(id);
  } catch {
    notFound();
  }

  const isProject = job.workType === "project";
  const statusBadge = getStatusBadge(job.status);
  const locationInfo = getLocationIcon(job.locationType);
  const workTypeInfo = getWorkTypeIcon(job.workType);

  const companyTypeLabel =
    job.companyType === "individual" ? "Individual" : "Company";
  const displayCompanyName = job.companyName || null;
  const genderLabel =
    job.gender === "all" || job.gender === "both"
      ? "All Genders"
      : `${job.gender.charAt(0).toUpperCase() + job.gender.slice(1)} Only`;

  return (
    <div className="w-full max-w-xl p-2 space-y-4 mb-10">
      <BackButton title="Job Details" />

      {/* ── Job Header ─────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm">
          <User
            avatarProps={{
              src: job.author?.avatarUrl ?? "",
              alt: "Admin Avatar",
            }}
            name={job.author?.name ?? "Admin"}
          />
          <div
            className={`flex h-7 items-center justify-center px-3 rounded-full ${statusBadge.bg} border ${statusBadge.border}`}
          >
            <span
              className={`${statusBadge.text} text-xs font-bold uppercase tracking-wider`}
            >
              {job.status}
            </span>
          </div>
        </div>

        <h1 className="text-gray-900 dark:text-white text-[28px] font-bold leading-[1.2] mb-1">
          Role: {job.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-base font-medium mb-3">
          {displayCompanyName ? `${displayCompanyName} · ` : ""}
          {companyTypeLabel}
        </p>

        {/* Salary / Budget */}
        {(isProject ? job.budget : job.salary) && (
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-primary text-[26px] font-bold tracking-tight truncate max-w-full">
              {isProject ? job.budget : job.salary}
            </h2>
            {isProject && job.duration && (
              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                ({job.duration})
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Quick-glance icon cards ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-2 justify-center items-center">
          <CardHeader className="justify-center p-1">
            {workTypeInfo.icon}
          </CardHeader>
          <p className="text-sm text-center">{workTypeInfo.label}</p>
        </Card>
        <Card className="p-2 justify-center items-center">
          <CardHeader className="justify-center p-1">
            {locationInfo.icon}
          </CardHeader>
          <p className="text-sm text-center">{locationInfo.label}</p>
        </Card>
        <Card className="p-2 justify-center items-center">
          <CardHeader className="justify-center p-1">
            <FaClock size={30} className="text-primary" />
          </CardHeader>
          <p className="text-sm text-center">{job.timing ?? "—"}</p>
        </Card>
      </div>

      {/* ── Qualification / Brief highlight boxes ──────────────── */}
      {(job.requiredQualification || job.brief) && (
        <div className="space-y-3">
          {job.requiredQualification && (
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-3 rounded-lg">
              <LuNotebookText
                className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                size={32}
              />
              <div className="flex flex-col justify-center">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-0.5">
                  Required Qualification
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium whitespace-pre-wrap">
                  {job.requiredQualification}
                </p>
              </div>
            </div>
          )}
          {job.brief && (
            <div className="flex gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 p-3 rounded-lg">
              <LuNotebookText
                className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
                size={32}
              />
              <div className="flex flex-col justify-center">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wide mb-0.5">
                  {isProject ? "Project Brief" : "Additional Notes"}
                </p>
                <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium whitespace-pre-wrap">
                  {job.brief}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Job Details Card ────────────────────────────────────── */}
      <Card className="w-full p-4">
        <CardHeader className="p-0">
          <FaUserAlt size={22} className="text-primary inline-block mr-2" />
          <h3 className="text-lg font-bold">Job Details</h3>
        </CardHeader>
        <div className="mt-3 px-1 space-y-3">
          <DetailRow label="Job ID" value={`# ${job.jobId}`} />
          <DetailRow label="Work Type" value={workTypeInfo.label} />
          {displayCompanyName && (
            <DetailRow label="Company Name" value={displayCompanyName} />
          )}
          <DetailRow label="Company Type" value={companyTypeLabel} />
          {job.experience && (
            <DetailRow label="Experience" value={`${job.experience}yrs`} />
          )}
          <DetailRow label="Gender Preference" value={genderLabel} />
          {job.timing && <DetailRow label="Working Hours" value={job.timing} />}
          {!isProject && job.salary && (
            <DetailRow
              label="Salary"
              value={
                <span className="inline-flex items-center gap-1">
                  <BsCurrencyRupee size={14} />
                  {job.salary}
                </span>
              }
            />
          )}
          {isProject && job.budget && (
            <DetailRow label="Budget" value={job.budget} />
          )}
          {isProject && job.duration && (
            <DetailRow label="Duration" value={job.duration} />
          )}
          {isProject && job.projectType && (
            <DetailRow
              label="Project Type"
              value={<span className="capitalize">{job.projectType}</span>}
            />
          )}
        </div>
      </Card>

      {/* ── Commission Details Card ─────────────────────────────── */}
      <Card className="w-full p-4">
        <CardHeader className="p-0">
          <TbReportMoney size={26} className="text-primary inline-block mr-2" />
          <h3 className="text-lg font-bold">Commission Info</h3>
        </CardHeader>
        <div className="mt-3 px-1 space-y-3">
          <DetailRow
            label="Commission Basis"
            value={formatCommissionBasis(job.commissionBasis)}
          />
          <DetailRow
            label="Academy Commission"
            value={`${job.academyCommissionPercentage}%`}
          />
        </div>
      </Card>

      {/* ── Skills Required Card ────────────────────────────────── */}
      {job.skillsRequired && (
        <Card className="w-full p-4">
          <CardHeader className="p-0">
            <FaCode size={22} className="text-primary inline-block mr-2" />
            <h3 className="text-lg font-bold">Skills Required</h3>
          </CardHeader>
          <p className="mt-3 px-1 text-sm font-medium text-slate-600 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
            {job.skillsRequired}
          </p>
        </Card>
      )}

      {/* ── Travel Requirements Card ────────────────────────────── */}
      {job.travelRequirements && (
        <Card className="w-full p-4">
          <CardHeader className="p-0">
            <MdCardTravel
              size={26}
              className="text-primary inline-block mr-2"
            />
            <h3 className="text-lg font-bold">Travel Requirements</h3>
          </CardHeader>
          <p className="mt-3 px-1 text-sm font-medium text-slate-600 dark:text-slate-100 leading-relaxed">
            {job.travelRequirements}
          </p>
        </Card>
      )}

      {/* ── Location Card ───────────────────────────────────────── */}
      <Card className="w-full p-4">
        <CardHeader className="p-0">
          <FaMapMarkerAlt
            size={26}
            className="text-primary inline-block mr-2"
          />
          <h3 className="text-lg font-bold">Location</h3>
        </CardHeader>
        <p className="mt-3 px-1 text-md font-medium text-slate-600 dark:text-slate-100 leading-snug">
          {job.location}
        </p>
      </Card>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <div className="flex gap-4 max-w-xl mx-auto z-10">
        <Button className="w-full" size="lg">
          <SlShare size={18} className="inline-block mr-2" />
          Share
        </Button>
        <ApplyActionButton
          target="job"
          targetId={id}
          initialApplied={false}
          ineligibleLabel="Candidates Only"
          className="w-full"
          size="lg"
          color="primary"
        />
      </div>
    </div>
  );
}
