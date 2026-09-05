"use client";

import { Tab, Tabs } from "@heroui/tabs";
import { LuNotebookPen } from "react-icons/lu";
import { PiBagSimpleDuotone } from "react-icons/pi";
import TuitionPost, {
  type StudentProp,
} from "@/components/PostCards/TuitionPost";
import JobPost from "@/components/PostCards/JobPost";

// ─── Serializable data shapes passed from the server component ──────────

export type ApplicationStatus =
  | "applied"
  | "DC"
  | "GC"
  | "approved"
  | "decline"
  | "auto_declined"
  | "withdrawn";

export interface DashboardPostItem {
  postId: string;
  enquiryId?: string;
  guardianName: string;
  guardianPhone: string;
  students: StudentProp[];
  preferredTime?: string;
  preferredDays: string[];
  frequencyPerWeek: number;
  classType: "online" | "offline" | "both";
  location: string;
  monthlyBudget: number;
  notes?: string;
  status: "open" | "matched" | "closed" | "cancelled" | "hold";
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  applicantCount: number;
  createdByUserId?: { name?: string; avatar?: string | null };
  applicationStatus?: ApplicationStatus;
  applicationId?: string;
  dcDate?: string;
  gcDate?: string;
  declineReason?: string;
}

export interface DashboardJobItem {
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
  createdAt: string;
}

interface DashboardTabsProps {
  appliedPosts: DashboardPostItem[];
  appliedJobs: DashboardJobItem[];
  showJobsTab: boolean;
}

export default function DashboardTabs({
  appliedPosts,
  appliedJobs,
  showJobsTab,
}: DashboardTabsProps) {
  return (
    <Tabs
      aria-label="Options"
      color="primary"
      variant="solid"
      className="sticky top-18 z-20"
      radius="full"
    >
      <Tab
        key="tuition"
        title={
          <div className="w-full flex items-center space-x-2">
            <LuNotebookPen size={20} />
            <span>Tuition</span>
          </div>
        }
        className="w-full max-w-md"
      >
        <div className="space-y-3">
          {appliedPosts.length === 0 ? (
            <p className="text-center text-default-500 mt-8">
              You have not applied to any tuition posts yet.
            </p>
          ) : (
            appliedPosts.map((item) => (
              <TuitionPost
                key={item.postId}
                postId={item.postId}
                enquiryId={item.enquiryId}
                guardianName={item.guardianName}
                guardianPhone={item.guardianPhone}
                students={item.students}
                preferredTime={item.preferredTime}
                preferredDays={item.preferredDays}
                frequencyPerWeek={item.frequencyPerWeek}
                classType={item.classType}
                location={item.location}
                monthlyBudget={item.monthlyBudget}
                notes={item.notes}
                status={item.status}
                createdAt={new Date(item.createdAt)}
                updatedAt={new Date(item.updatedAt)}
                isEdited={item.isEdited}
                createdByUserId={item.createdByUserId}
                applicationStatus={item.applicationStatus}
                applicationId={item.applicationId}
                dcDate={item.dcDate}
                gcDate={item.gcDate}
                declineReason={item.declineReason}
                applicants={Array.from(
                  { length: item.applicantCount },
                  (_, i) => `${item.postId}-${i}`,
                )}
                initialApplied={true}
                isSignedIn={true}
                canApply={true}
              />
            ))
          )}
        </div>
      </Tab>

      {showJobsTab ? (
        <Tab
          key="jobs"
          title={
            <div className="w-full flex items-center space-x-2">
              <PiBagSimpleDuotone size={20} />
              <span>Jobs</span>
            </div>
          }
          className="w-full max-w-md"
        >
          <div className="space-y-3">
            {appliedJobs.length === 0 ? (
              <p className="text-center text-default-500 mt-8">
                You have not applied to any jobs yet.
              </p>
            ) : (
              appliedJobs.map((item) => (
                <JobPost
                  key={item.jobId}
                  jobId={item.jobId}
                  clientName={item.clientName}
                  companyType={item.companyType}
                  title={item.title}
                  workType={item.workType}
                  experience={item.experience}
                  locationType={item.locationType}
                  location={item.location}
                  gender={item.gender}
                  timing={item.timing}
                  salary={item.salary}
                  requiredQualification={item.requiredQualification}
                  projectType={item.projectType}
                  budget={item.budget}
                  duration={item.duration}
                  brief={item.brief}
                  status={item.status}
                  createdAt={item.createdAt}
                  initialApplied={true}
                  isSignedIn={true}
                  canApply={true}
                />
              ))
            )}
          </div>
        </Tab>
      ) : null}
    </Tabs>
  );
}
