import ShareButton from "@/components/ShareButton";
import { formatSubjectsList } from "@/lib/utils/subject";
import { Button } from "@heroui/button";
import { Card, CardHeader } from "@heroui/card";
import { FaHome } from "react-icons/fa";
import { LuMapPin, LuNotebookText } from "react-icons/lu";
import { SlCalender, SlShare } from "react-icons/sl";
import { PiClockCountdownFill } from "react-icons/pi";
import { MdOutlineOnlinePrediction } from "react-icons/md";
import ApplyActionButton from "@/components/ApplyActionButton";
import BackButton from "@/components/BackButton";
import { getPostByPostId } from "@/lib/services/post.service";
import { notFound } from "next/navigation";
import { reportError } from "@/lib/sentry-report";

const EDITED_THRESHOLD_MS = 1000;

const getStatusBadge = (status: string) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    open: {
      bg: "bg-green-100 dark:bg-green-900/40",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-700 dark:text-green-300",
    },
    matched: {
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
    hold: {
      bg: "bg-gray-100 dark:bg-gray-900/40",
      border: "border-gray-200 dark:border-gray-800",
      text: "text-gray-700 dark:text-gray-300",
    },
  };
  return colors[status] || colors.open;
};

const getClassTypeIcon = (type: string) => {
  switch (type) {
    case "offline":
      return {
        icon: <FaHome size={30} className="text-primary" />,
        label: "Offline At Home",
      };
    case "online":
      return {
        icon: <MdOutlineOnlinePrediction size={30} className="text-primary" />,
        label: "Online",
      };
    case "both":
      return {
        icon: <FaHome size={30} className="text-primary" />,
        label: "Both Online & Offline",
      };
    default:
      return {
        icon: <FaHome size={30} className="text-primary" />,
        label: type,
      };
  }
};

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: postId } = await params;

  let post;
  try {
    post = await getPostByPostId(postId);
  } catch (error) {
    reportError(error, {
      route: "GET /posts/[id]",
      tags: { feature: "public-tuition-detail" },
      extra: { postId },
    });
    notFound();
  }

  const safeStudents = post.students ?? [];
  const allSubjects = safeStudents.flatMap((s) => s.subjects);
  const subjectDisplay = formatSubjectsList(allSubjects) || "N/A";
  const classDisplay = safeStudents.map((s) => s.className).join(", ");
  const boardDisplay = safeStudents.map((s) => s.board).join(", ");
  const statusBadge = getStatusBadge(post.status);
  const classTypeInfo = getClassTypeIcon(post.classType);
  const isEdited =
    Boolean(post.updatedByAdminClerkId) ||
    new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() >
    EDITED_THRESHOLD_MS;

  const freqText =
    post.frequencyPerWeek === 7
      ? "Daily"
      : `${post.frequencyPerWeek} Days Per Week`;


  const shareData = {
    postId: post.postId,
    className: classDisplay || "N/A",
    board: boardDisplay || "N/A",
    subjects: subjectDisplay,
    monthlyBudget: post.monthlyBudget,
    classType: post.classType,
    frequencyPerWeek: post.frequencyPerWeek,
    preferredDays: post.preferredDays,
    location: post.location,
    notes: post.notes,
  };
  return (
    <div className="w-full max-w-xl p-2 space-y-4">
      <BackButton title="Post Details" />

      {/* Post Header */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium tracking-wide ">
            Post ID: #{post.postId}
          </p>
          <div className="flex items-center gap-2">
            {isEdited ? (
              <div className="flex h-7 items-center justify-center rounded-full border border-amber-200 bg-amber-100 px-3 dark:border-amber-800 dark:bg-amber-900/40">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Edited
                </span>
              </div>
            ) : null}
            <div
              className={`flex h-7 items-center justify-center px-3 rounded-full ${statusBadge.bg} border ${statusBadge.border}`}
            >
              <span
                className={`${statusBadge.text} text-xs font-bold uppercase tracking-wider`}
              >
                {post.status}
              </span>
            </div>
          </div>
        </div>
        <h1 className="text-gray-900 dark:text-white text-[28px] font-bold leading-[1.2] mb-1">
          {subjectDisplay} for Class {classDisplay}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-base font-medium mb-3">
          {boardDisplay}
        </p>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-primary text-[26px] font-bold tracking-tight">
            {post.monthlyBudget > 0
              ? "₹" + post.monthlyBudget.toLocaleString()
              : "Fees to be discussed"}
          </h2>
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            {post.monthlyBudget > 0 ? "/month" : ""}
          </span>
        </div>
      </div>

      {/* Class Details */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-2 justify-center items-center">
          <CardHeader className="justify-center p-1">
            {classTypeInfo.icon}
          </CardHeader>
          <p className="text-sm text-center">{classTypeInfo.label}</p>
        </Card>
        <Card className="p-2 justify-center items-center">
          <CardHeader className="justify-center p-1">
            <SlCalender size={30} className="text-primary" />
          </CardHeader>
          <p className="text-sm text-center">{freqText}</p>
        </Card>
        <Card className="p-2 justify-center items-center">
          <CardHeader className="justify-center p-1">
            <PiClockCountdownFill size={30} className="text-primary" />
          </CardHeader>
          <p className="text-sm text-center">{post.preferredTime}</p>
        </Card>
      </div>

      {/* Notes */}
      {post.notes && (
        <div className="my-4">
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-2 rounded-lg">
            <LuNotebookText
              className="text-amber-600 dark:text-amber-400"
              size={35}
            />
            <div className="flex flex-col justify-center">
              <p className="text-md font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-0.5">
                Notes
              </p>
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                {post.notes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Post information */}
      <Card className="w-full p-4">
        <CardHeader className="p-0">
          <PiClockCountdownFill
            size={30}
            className="text-primary inline-block mr-2"
          />
          <h3 className="text-lg font-bold">Schedule & Timing</h3>
        </CardHeader>
        <div className="mt-3 px-3 space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Preferred Days
            </span>
            <span className="text-gray-900 dark:text-white font-medium text-sm text-right">
              {post.preferredDays.join(", ") || "Not specified"}
            </span>
          </div>
          <div className="flex gap-3 justify-between items-center border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Subjects
            </span>
            <span className="text-gray-900 dark:text-white font-medium text-sm text-right">
              {subjectDisplay}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Frequency
            </span>
            <span className="text-gray-900 dark:text-white font-medium text-sm text-right">
              {freqText}
            </span>
          </div>
        </div>
      </Card>

      {/* location card */}
      <Card className="w-full p-4">
        <CardHeader className="p-0">
          <LuMapPin size={30} className="text-primary inline-block mr-2" />
          <h3 className="text-lg font-bold">Location</h3>
        </CardHeader>
        <p className="mt-3 px-3 text-md font-medium text-slate-600 dark:text-slate-100 leading-snug">
          {post.location}
        </p>
      </Card>

      {/* Action Buttons */}
      <div className=" flex gap-4 max-w-xl mx-auto z-10">
        <ShareButton type="tuition" data={shareData} className="w-full" />

        <ApplyActionButton
          target="post"
          targetId={postId}
          initialApplied={false}
          ineligibleLabel="Not Eligible"
          className="w-full"
          size="lg"
          color="primary"
        />
      </div>
    </div>
  );
}
