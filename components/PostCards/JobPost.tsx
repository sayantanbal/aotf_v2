"use client";

import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { User } from "@heroui/user";
import { FaMapMarkerAlt, FaArrowRight, FaShare, FaEye } from "react-icons/fa";
import { BsCurrencyRupee } from "react-icons/bs";
import { FaClock } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import {
  formatJobShare,
  shareOnWhatsApp,
  type JobShareData,
} from "@/lib/utils/share";
import ApplyActionButton from "@/components/ApplyActionButton";

interface JobPostProps {
  jobId: string;
  clientName: string;
  companyType: "individual" | "company";
  title: string;
  workType: "job" | "project";
  experience?: string;
  locationType: "remote" | "onsite" | "hybrid";
  location: string;
  gender: "male" | "female" | "both" | "all";
  timing: string;
  salary?: string;
  requiredQualification?: string;
  projectType?: "one-time" | "ongoing";
  budget?: string;
  duration?: string;
  brief?: string;
  status: "open" | "closed" | "hold" | "cancelled";
  createdAt: Date;
  initialApplied?: boolean;
  isSignedIn?: boolean;
  canApply?: boolean;
  applicantCount?: number;
  createdByUserId?: { name?: string; avatar?: string | null };
}

/* ---------- FORMATTERS ---------- */

const formatLocationType = (type: string) =>
  ({ remote: "Remote", onsite: "On-Site", hybrid: "Hybrid" })[type] ?? type;

const formatStatus = (status: string) =>
  ({
    open: "Open",
    closed: "Closed",
    hold: "Hold",
    cancelled: "Cancelled",
  })[status] ?? status;

const statusColor = (
  status: string,
): "success" | "default" | "warning" | "danger" =>
  ({
    open: "success" as const,
    closed: "default" as const,
    hold: "warning" as const,
    cancelled: "danger" as const,
  })[status] ?? "default";

const formatWorkType = (type: string) =>
  ({ job: "Job", project: "Project" })[type] ?? type;

const formatCompanyType = (type: string) =>
  ({ individual: "Individual", company: "Company" })[type] ?? type;

const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  if (diffHours > 0)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffMins > 0) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  return "Just now";
};

/* ---------- COMPONENT ---------- */

const JobPost = ({
  jobId,
  clientName,
  companyType,
  title,
  workType,
  experience,
  locationType,
  location,
  gender,
  timing,
  salary,
  requiredQualification,
  budget,
  duration,
  status,
  initialApplied = false,
  isSignedIn,
  canApply,
  createdAt,
  applicantCount = 0,
  createdByUserId = {},
}: JobPostProps) => {
  const router = useRouter();

  const handleShare = () => {
    const shareData: JobShareData = {
      jobId,
      title,
      companyName: companyType === "company" ? clientName : undefined,
      location,
      salary,
      budget,
      requiredQualification,
      gender,
      workType,
    };
    shareOnWhatsApp(formatJobShare(shareData));
  };

  const chips = [
    formatWorkType(workType),
    experience ? ` ${experience} years` : null,
    formatLocationType(locationType),
  ].filter(Boolean);

  return (
    <Card className="w-full mx-auto">
      {/* HEADER */}
      <CardHeader className="justify-between z-0">
        <User
          avatarProps={{
            src: `${createdByUserId.avatar || ""}`,
            alt: "Admin Avatar",
          }}
          name={createdByUserId.name || "Admin"}
          description={
            true ? `${getTimeAgo(createdAt)}` : `${getTimeAgo(createdAt)}`
          }
        />
        <div className="flex items-center gap-2">
          <Chip radius="sm" size="sm" color={statusColor(status)}>
            {formatStatus(status)}
          </Chip>
        </div>
      </CardHeader>

      {/* BODY */}
      <CardBody className="px-3 py-0 text-small text-default-500">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3 leading-snug">
          {title}
        </h1>

        {/* Chips */}
        <div className="flex gap-2 flex-wrap">
          {chips.map((chip) => (
            <Chip
              key={chip}
              radius="sm"
              variant="shadow"
              size="sm"
              className="bg-default-100 text-sm font-medium"
            >
              {chip}
            </Chip>
          ))}
        </div>

        {/* Location */}
        <div className="flex items-center gap-3 my-2">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
            <FaMapMarkerAlt size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Location
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
              {location}
            </p>
          </div>
        </div>

        {/* Salary or Budget */}
        {(workType === "job" ? salary : budget) && (
          <div className="flex items-center gap-3 my-2">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
              <BsCurrencyRupee size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {workType === "job" ? "Salary" : "Budget"}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                {workType === "job" ? salary : budget}
                {workType === "project" && duration && ` (${duration})`}
              </p>
            </div>
          </div>
        )}

        {/* Timing */}
        <div className="flex items-center gap-3 my-2">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
            <FaClock size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Working Hours
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
              {timing}
            </p>
          </div>
        </div>

        {/* Qualification */}
        {requiredQualification && (
          <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <p className="text-xs font-bold uppercase text-amber-700 mb-1">
              Required Qualification
            </p>
            <p className="text-sm">{requiredQualification}</p>
          </div>
        )}
      </CardBody>

      {/* FOOTER */}
      <CardFooter>
        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            size="sm"
            className="bg-default-200"
            onClick={() => router.push(`/jobs/${jobId}`)}
          >
            View
            <FaEye />
          </Button>{" "}
          <Button size="sm" color="secondary" onClick={handleShare}>
            Share <FaShare />
          </Button>
          <ApplyActionButton
            target="job"
            targetId={jobId}
            initialApplied={initialApplied}
            isSignedIn={isSignedIn}
            isEligible={canApply}
            ineligibleLabel="Candidates Only"
            size="sm"
            color="primary"
          />
        </div>
      </CardFooter>
    </Card>
  );
};

export default JobPost;
