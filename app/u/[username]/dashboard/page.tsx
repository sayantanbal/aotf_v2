import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import DashboardTabs, {
  type DashboardPostItem,
  type DashboardJobItem,
} from "@/components/dashboard/DashboardTabs";
import {
  getApplicantPermissionsByClerkId,
  getAppliedJobsForApplicant,
  getAppliedPostsForApplicant,
} from "@/lib/services/application.service";
import { getAdminAuthorsByClerkIds } from "@/lib/services/admin-author.service";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";

// Force dynamic rendering to always fetch fresh application data
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/u/${username}/dashboard`)}`,
    );
  }

  await dbConnect();
  const currentUser = await User.findOne({ clerkId }).lean<{
    username: string;
  }>();

  if (
    !currentUser ||
    currentUser.username.toLowerCase() !== username.toLowerCase()
  ) {
    notFound();
  }

  const applicantPermissions = await getApplicantPermissionsByClerkId(clerkId, {
    ensureUser: true,
  });

  if (!applicantPermissions) {
    notFound();
  }

  const [appliedPosts, appliedJobs] = await Promise.all([
    getAppliedPostsForApplicant(applicantPermissions.applicantId),
    applicantPermissions.canApplyToJobs
      ? getAppliedJobsForApplicant(applicantPermissions.applicantId)
      : Promise.resolve([]),
  ]);

  const adminAuthors = await getAdminAuthorsByClerkIds(
    appliedPosts
      .map(({ post }) => post.createdByAdminClerkId)
      .filter((clerkId): clerkId is string => Boolean(clerkId)),
  );

  // Serialize lean Mongoose documents into plain objects for the client component
  const postItems: DashboardPostItem[] = appliedPosts.map(
    ({ post, application, applicantCount }) => ({
      postId: post.postId,
      enquiryId: post.enquiryId?.toString(),
      guardianName: post.guardianName,
      guardianPhone: post.guardianPhone,
      students: post.students.map((s) => ({
        className: s.className,
        board: s.board,
        subjects: [...s.subjects],
      })),
      preferredTime: post.preferredTime,
      preferredDays: [...post.preferredDays],
      frequencyPerWeek: post.frequencyPerWeek,
      classType: post.classType,
      location: post.location,
      monthlyBudget: post.monthlyBudget,
      notes: post.notes,
      status: post.status,
      createdAt: new Date(post.createdAt).toISOString(),
      updatedAt: new Date(post.updatedAt).toISOString(),
      isEdited:
        Boolean(post.updatedByAdminClerkId) ||
        new Date(post.updatedAt).getTime() -
          new Date(post.createdAt).getTime() >
          1000,
      applicantCount,
      createdByUserId: post.createdByAdminClerkId
        ? {
            name: adminAuthors.get(post.createdByAdminClerkId)?.name,
            avatar: adminAuthors.get(post.createdByAdminClerkId)?.avatarUrl,
          }
        : undefined,
      applicationStatus: application.status,
      applicationId: application.applicationId,
      dcDate: application.dcDate
        ? new Date(application.dcDate).toISOString()
        : application.dcMeta?.scheduledDate
          ? new Date(application.dcMeta.scheduledDate).toISOString()
          : undefined,
      gcDate: application.gcMeta?.scheduledDate
        ? new Date(application.gcMeta.scheduledDate).toISOString()
        : undefined,
      declineReason: application.declineMeta?.reason,
    }),
  );

  const jobItems: DashboardJobItem[] = appliedJobs.map(({ job }) => ({
    jobId: job.jobId,
    clientName: job.clientName,
    companyType: job.companyType,
    title: job.title,
    workType: job.workType,
    experience: job.experience,
    locationType: job.locationType,
    location: job.location,
    gender: job.gender,
    timing: job.timing,
    salary: job.salary,
    requiredQualification: job.requiredQualification,
    projectType: job.projectType,
    budget: job.budget,
    duration: job.duration,
    brief: job.brief,
    status: job.status,
    createdAt: new Date(job.createdAt).toISOString(),
  }));

  return (
    <div className="w-full">
      <BackButton title="Dashboard" />

      <div className="w-full flex flex-col items-center justify-center">
        <DashboardTabs
          appliedPosts={postItems}
          appliedJobs={jobItems}
          showJobsTab={applicantPermissions.canApplyToJobs}
        />
      </div>
    </div>
  );
}
