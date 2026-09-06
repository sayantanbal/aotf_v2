"use client";
import { useState } from "react";
import { reportClientError } from "@/lib/client-report-error";
import { User } from "@heroui/user";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { FaMapMarkerAlt, FaShare } from "react-icons/fa";
import { BsCurrencyRupee } from "react-icons/bs";
import { LuNotebookText } from "react-icons/lu";
import { FaEye } from "react-icons/fa";
import { SlCalender } from "react-icons/sl";
import { FaBookOpen } from "react-icons/fa";
import {
  MdOutlinePendingActions,
  MdCheckCircle,
  MdCancel,
} from "react-icons/md";
import { useRouter } from "next/navigation";
import {
  formatTuitionShare,
  shareOnWhatsApp,
  type TuitionShareData,
} from "@/lib/utils/share";
import ApplyActionButton from "@/components/ApplyActionButton";
import { formatDisplayDate } from "@/lib/utils/display-date";

export type ApplicationStatus =
  | "applied"
  | "pending"
  | "shortlisted"
  | "DC"
  | "GC"
  | "approved"
  | "decline"
  | "declined"
  | "auto_declined"
  | "withdrawn";

export interface StudentProp {
  className: string;
  board: string;
  subjects: string[];
  subjectsNormalized?: string[];
}

interface TuitionPostProps {
  postId: string;
  enquiryId?: string;
  guardianName?: string;
  guardianPhone?: string;
  students: StudentProp[];
  preferredTime?: string;
  preferredDays?: string[];
  frequencyPerWeek: number;
  classType: "online" | "offline" | "both";
  location?: string;
  monthlyBudget?: number;
  notes?: string;
  status: "open" | "matched" | "closed" | "cancelled" | "hold";
  createdAt: Date;
  updatedAt: Date;
  isEdited?: boolean;
  applicants?: string[];
  createdByUserId?: { name?: string; avatar?: string | null };
  initialApplied?: boolean;
  isSignedIn?: boolean;
  canApply?: boolean;
  applicationStatus?: ApplicationStatus;
  applicationId?: string;
  dcDate?: string;
  gcDate?: string;
  declineReason?: string;
  startingDate?: string;
}

const getFrequencyText = (freq: number): string => {
  if (freq === 7) return "Daily";
  return `${freq} day${freq !== 1 ? "s" : ""} /Week`;
};

const getClassTypeText = (type: string): string => {
  const types: Record<string, string> = {
    offline: "In-Person",
    online: "Online",
    both: "Both",
  };
  return types[type] || type;
};

const getStatusLabel = (status: string) =>
  ({
    open: "Open",
    matched: "Matched",
    closed: "Closed",
    cancelled: "Close",
    hold: "Hold",
  })[status] ?? status;

const getStatusColor = (
  status: string,
): "success" | "default" | "warning" | "danger" =>
  ({
    open: "success" as const,
    matched: "warning" as const,
    closed: "default" as const,
    cancelled: "danger" as const,
    hold: "warning" as const,
  })[status] ?? "default";

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

const TuitionPost = ({
  postId,
  enquiryId,
  guardianName,
  guardianPhone,
  students,
  preferredTime,
  preferredDays,
  frequencyPerWeek,
  classType,
  location,
  monthlyBudget,
  notes,
  status,
  createdAt,
  updatedAt,
  isEdited = false,
  applicants = [],
  createdByUserId = {},
  initialApplied = false,
  isSignedIn,
  canApply,
  applicationStatus,
  applicationId,
  dcDate,
  gcDate,
  declineReason,
  startingDate,
}: TuitionPostProps) => {
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(applicationStatus);

  // Can withdraw if applied and status is not terminal
  const canWithdraw =
    initialApplied &&
    applicationId &&
    currentStatus &&
    !["approved", "decline", "auto_declined", "withdrawn"].includes(
      currentStatus,
    );

  const handleWithdraw = async () => {
    if (!applicationId) return;
    setIsWithdrawing(true);
    try {
      const response = await fetch(`/api/v1/me/applications/${applicationId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        addToast({
          description: data.error || "Failed to withdraw application",
          color: "danger",
        });
        return;
      }
      setCurrentStatus("withdrawn");
      addToast({
        description: "Application withdrawn successfully",
        color: "success",
      });
      onClose();
    } catch (error) {
      reportClientError(error, { feature: "tuition-post-card" });
      addToast({
        description: "An error occurred while withdrawing",
        color: "danger",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Derive display values from students array (defensive fallback)
  const safeStudents = students ?? [];
  const allSubjects = safeStudents.flatMap((s) => s.subjects);
  const subjectDisplay = allSubjects.join(", ") || "N/A";
  const classDisplay = safeStudents.map((s) => s.className).join(", ");
  const boardDisplay = safeStudents.map((s) => s.board).join(", ");

  const chips = [
    `Class - ${classDisplay}`,
    `Board - ${boardDisplay.toUpperCase()}`,
  ].filter(Boolean);

  const handleShare = () => {
    const shareData: TuitionShareData = {
      postId,
      className: classDisplay || "N/A",
      board: boardDisplay || "N/A",
      subjects: allSubjects.join(", ") || "N/A",
      monthlyBudget,
      classType,
      frequencyPerWeek,
      preferredDays,
      location,
      notes,
    };
    shareOnWhatsApp(formatTuitionShare(shareData));
  };

  // Helper function to format date with AM/PM
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    const formattedDate = date.toLocaleDateString("en-IN", dateOptions);
    const formattedTime = date.toLocaleTimeString("en-IN", timeOptions);
    return `${formattedDate} at ${formattedTime}`;
  };

  // Helper function to get application status display info
  const getApplicationStatusDisplay = () => {
    if (!currentStatus) return null;

    switch (currentStatus) {
      case "approved":
        return {
          label: "Approved! You have been selected for this tuition.",
          subLabel: startingDate
            ? `Tuition starts on ${formatDisplayDate(startingDate)}`
            : null,
          color:
            "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30",
          textColor: "text-green-800 dark:text-green-400",
          Icon: MdCheckCircle,
          iconColor: "text-green-600 dark:text-green-400",
        };
      case "decline":
        return {
          label: "Your application was not selected.",
          subLabel: declineReason || null,
          color:
            "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30",
          textColor: "text-red-800 dark:text-red-400",
          Icon: MdCancel,
          iconColor: "text-red-600 dark:text-red-400",
        };
      case "auto_declined":
        return {
          label:
            "Application auto-declined, someone above you in the application queue was selected.",
          subLabel: null,
          color:
            "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30",
          textColor: "text-red-800 dark:text-red-400",
          Icon: MdCancel,
          iconColor: "text-red-600 dark:text-red-400",
        };
      case "withdrawn":
        return {
          label: "You have withdrawn your application.",
          subLabel: null,
          color:
            "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/30",
          textColor: "text-gray-800 dark:text-gray-400",
          Icon: MdCancel,
          iconColor: "text-gray-600 dark:text-gray-400",
        };
      case "DC":
        return {
          label: "🎓 Demo Class Scheduled",
          subLabel: dcDate
            ? `Your demo class is on ${formatDate(dcDate)}`
            : "A demo class has been scheduled for you",
          color:
            "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30",
          textColor: "text-blue-800 dark:text-blue-400",
          Icon: MdOutlinePendingActions,
          iconColor: "text-blue-600 dark:text-blue-400",
        };
      case "GC":
        return {
          label: "✅ Demo Class Completed - Awaiting Guardian Confirmation",
          subLabel: gcDate
            ? `Guardian meeting scheduled for ${formatDate(gcDate)}`
            : "Waiting for guardian confirmation",
          color:
            "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30",
          textColor: "text-purple-800 dark:text-purple-400",
          Icon: MdOutlinePendingActions,
          iconColor: "text-purple-600 dark:text-purple-400",
        };
      case "applied":
      default:
        return {
          label: "Application is being evaluated",
          subLabel: "You will be notified when your demo class is scheduled",
          color:
            "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30",
          textColor: "text-blue-800 dark:text-blue-400",
          Icon: MdOutlinePendingActions,
          iconColor: "text-blue-600 dark:text-blue-400",
        };
    }
  };

  const statusDisplay = getApplicationStatusDisplay();

  return (
    <Card className="max-w-lg w-full mx-auto">
      <CardHeader className="justify-between z-0">
        <User
          avatarProps={{
            src: `${createdByUserId.avatar || ""}`,
            alt: "Creator Avatar",
          }}
          description={
            isEdited ? `${getTimeAgo(createdAt)}` : `${getTimeAgo(createdAt)}`
          }
          name={createdByUserId.name || "Admin"}
        />
        <div className="flex items-center gap-2">
          <Chip radius="sm" size="sm" color={getStatusColor(status)}>
            {getStatusLabel(status)}
          </Chip>
          {isEdited ? (
            <Chip
              radius="sm"
              size="sm"
              variant="flat"
              className="bg-amber-100 text-amber-800"
            >
              Edited
            </Chip>
          ) : null}
          {/* <Chip radius="sm" size="sm" className="bg-default-200">
            <div className="flex items-center">
              {applicants.length} <User2 size={14} className="ml-1" />
            </div>
          </Chip> */}
        </div>
      </CardHeader>
      <CardBody className="px-3 py-0 text-small text-default-400">
        {/* Application Status Banner */}
        {statusDisplay && (
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border mb-3 ${statusDisplay.color}`}
          >
            <statusDisplay.Icon
              size={24}
              className={`${statusDisplay.iconColor} shrink-0 mt-0.5`}
            />
            <div className="flex flex-col">
              <p className={`text-sm font-medium ${statusDisplay.textColor}`}>
                {statusDisplay.label}
              </p>
              {statusDisplay.subLabel && (
                <p
                  className={`text-xs mt-1 ${statusDisplay.textColor} opacity-80`}
                >
                  {statusDisplay.subLabel}
                </p>
              )}
            </div>
          </div>
        )}

        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3 leading-snug">
          {subjectDisplay.toUpperCase() || "SUBJECTS NOT SPECIFIED"}
        </h1>
        {/* 3 chips with map function */}
        <div className="flex gap-2 flex-wrap">
          {chips.map((chip) => (
            <Chip
              key={chip}
              size="sm"
              radius="sm"
              variant="shadow"
              className="bg-default-100 text-sm font-medium"
            >
              {chip}
            </Chip>
          ))}
        </div>

        {location && (
          <div className="flex items-center gap-3 group my-2">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
              <FaMapMarkerAlt size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Location
              </span>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                {location}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 group my-2">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
            <BsCurrencyRupee size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Monthly Budget
            </span>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
              {monthlyBudget ? (
                <>₹ {monthlyBudget.toLocaleString()}/month</>
              ) : (
                "To be decided"
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Card className="w-full p-3 h-fit">
            <CardHeader className="p-0 mb-2 z-0">
              <SlCalender
                size={20}
                className="text-primary inline-block mr-2"
              />
              <h3 className="text-md font-bold">Frequency</h3>
            </CardHeader>
            <p className="text-sm">{getFrequencyText(frequencyPerWeek)}</p>
          </Card>
          <Card className="w-full p-3 h-fit">
            <CardHeader className="p-0 mb-2 z-0">
              <FaBookOpen
                size={20}
                className="text-primary inline-block mr-2"
              />
              <h3 className="text-md font-bold">Class Type</h3>
            </CardHeader>
            <p className="text-sm">{getClassTypeText(classType)}</p>
          </Card>
        </div>
        {notes && (
          <div className="mt-2 mb-4">
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-2 rounded-lg">
              <LuNotebookText
                size={24}
                className="text-amber-600 dark:text-amber-400"
              />
              <div className="flex flex-col justify-center">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-0.5">
                  Notes
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  {notes}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardBody>
      {/* <Divider /> */}
      <CardFooter className="gap-3">
        <div className="grid grid-cols-3 gap-2 justify-between w-full">
          <Button
            size="sm"
            className="bg-default-200"
            onClick={() => router.push(`/posts/${postId}`)}
          >
            View
            <FaEye />
          </Button>
          <Button size="sm" color="secondary" onClick={handleShare}>
            Share
            <FaShare />
          </Button>
          {canWithdraw ? (
            <Button size="sm" color="danger" variant="flat" onPress={onOpen}>
              Withdraw
            </Button>
          ) : (
            <ApplyActionButton
              target="post"
              targetId={postId}
              initialApplied={initialApplied && currentStatus !== "withdrawn"}
              onApplied={() => setCurrentStatus("applied")}
              isSignedIn={isSignedIn}
              isEligible={canApply}
              ineligibleLabel="Not Eligible"
              size="sm"
              color="primary"
            />
          )}
        </div>
      </CardFooter>

      {/* Withdraw Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Withdraw Application</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to withdraw your application for this
              tuition?
            </p>
            <p className="text-sm text-default-500 mt-2">
              This action cannot be undone. You can reapply later if the post is
              still open.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose} isDisabled={isWithdrawing}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleWithdraw}
              isLoading={isWithdrawing}
            >
              Withdraw
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
};

export default TuitionPost;
