"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import {
  User,
  Phone,
  MapPin,
  BookOpen,
  Calendar,
  DollarSign,
  Users,
  Share2,
  Eye,
  XCircle,
  CheckCircle,
  Clock,
  Edit,
  Receipt,
} from "lucide-react";
import { FaRupeeSign } from "react-icons/fa";
import { formatPhone } from "@/lib/utils/phone";
import {
  formatTuitionShare,
  shareOnWhatsApp,
  type TuitionShareData,
} from "@/lib/utils/share";

export interface TuitionPostStudent {
  className: string;
  board: string;
  subjects: string[];
  subjectsNormalized?: string[];
}

export interface TuitionPost {
  id: string;
  enquiryReferenceId?: string | null;
  guardian: string;
  guardianPhone: string;
  students: TuitionPostStudent[];
  location: string;
  budget: number;
  classType: "online" | "offline" | "both";
  frequency: number;
  preferredDays: string[];
  preferredTime?: string;
  notes: string;
  status: "open" | "matched" | "closed" | "cancelled" | "hold";
  type: "post";
  invoiceId?: string | null;
  invoiceGenerated?: boolean;
  applicantCount: number;
  applicationStats: {
    pending: number;
    DC: number;
    GC: number;
    approved: number;
    declined: number;
    withdrawn: number;
    total: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface TuitionPostCardProps {
  post: TuitionPost;
  onShare?: (post: TuitionPost) => void;
  onCancel?: (post: TuitionPost) => void;
  onView?: (post: TuitionPost) => void;
  onEdit?: (post: TuitionPost) => void;
  onGenerateInvoice?: (post: TuitionPost) => void;
}

export const TuitionPostCard: React.FC<TuitionPostCardProps> = ({
  post,
  onShare,
  onCancel,
  onView,
  onEdit,
  onGenerateInvoice,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "success";
      case "closed":
      case "cancelled":
        return "danger";
      case "matched":
        return "warning";
      case "hold":
        return "secondary";
      default:
        return "default";
    }
  };

  const getClassTypeLabel = (type: string) => {
    switch (type) {
      case "offline":
        return "In-Person";
      case "online":
        return "Online";
      case "both":
        return "Both";
      default:
        return type;
    }
  };

  const getFrequencyLabel = (freq: number) => {
    if (freq === 7) return "Daily";
    return `${freq} day${freq !== 1 ? "s" : ""}/week`;
  };
  // Derive display values from students array
  const safeStudents = post.students ?? [];
  const allSubjects = safeStudents.flatMap((s) => s.subjects);
  const subjectDisplay = allSubjects.join(", ") || "N/A";
  const classDisplay = safeStudents.map((s) => s.className).join(", ");
  const boardDisplay = safeStudents.map((s) => s.board).join(", ");
  const title = `${subjectDisplay} - Class ${classDisplay}`;
  const subtitle = `${boardDisplay} • ${post.location}`;

  const handleShare = () => {
    const shareData: TuitionShareData = {
      postId: post.id,
      className: classDisplay || "N/A",
      board: boardDisplay || "N/A",
      subjects: subjectDisplay,
      monthlyBudget: post.budget,
      classType: post.classType,
      frequencyPerWeek: post.frequency,
      preferredDays: post.preferredDays,
      location: post.location,
      notes: post.notes,
    };
    shareOnWhatsApp(formatTuitionShare(shareData));
    onShare?.(post);
  };

  return (
    <Card
      id={`tuition-post-${post.id}`}
      className="w-full max-w-md hover:shadow-lg transition-shadow duration-300 "
    >
      <CardHeader
        className="flex flex-col gap-3 pb-3 cursor-pointer"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex justify-between items-start w-full">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-md font-bold text-primary">{post.id}</p>
              <Chip
                size="sm"
                color={getStatusColor(post.status)}
                variant="flat"
                className="capitalize"
              >
                {post.status}
              </Chip>
            </div>
            {post.enquiryReferenceId && (
              <p className="text-xs text-default-500">
                Enquiry Ref: {post.enquiryReferenceId}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <Divider />

      {isExpanded && (
        <CardBody className="gap-1 py-1">
          {" "}
          <Button
            isIconOnly
            aria-label="Take a photo"
            variant="faded"
            className="absolute top-2 right-2"
            onPress={() => onEdit?.(post)}
          >
            <Edit size={16} />
          </Button>
          {/* Academic Details */}
          <p className="text-sm font-semibold text-default-700">
            Academic Details
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pl-2">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Class:</span>{" "}
                <span className="font-medium text-default-700">
                  {classDisplay}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Board:</span>{" "}
                <span className="font-medium text-default-700">
                  {boardDisplay.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Subject:</span>{" "}
                <span className="font-medium text-default-700">
                  {subjectDisplay}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Location:</span>{" "}
                <span className="font-medium text-default-700">
                  {post.location}
                </span>
              </div>
            </div>
          </div>
          <Divider />
          {/* Schedule & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pl-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Class Type:</span>{" "}
                <span className="font-medium text-default-700">
                  {getClassTypeLabel(post.classType)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Frequency:</span>{" "}
                <span className="font-medium text-default-700">
                  {getFrequencyLabel(post.frequency)}
                </span>
              </div>
            </div>{" "}
            {post.preferredTime && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-default-400" />
                <div>
                  <span className="text-default-500">Preferred Time:</span>{" "}
                  <span className="font-medium text-default-700">
                    {post.preferredTime}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <FaRupeeSign size={16} className="text-default-400" />
              <div>
                <span className="text-default-500">Monthly Fees:</span>{" "}
                <span className="font-medium text-success-600">
                  {post.budget
                    ? `₹${post.budget.toLocaleString()}`
                    : "To be decided"}
                </span>
              </div>
            </div>
          </div>
          {/* Preferred Days */}
          {post.preferredDays && post.preferredDays.length > 0 && (
            <>
              <Divider />
              <div className="flex flex-row gap-2">
                <p className="text-sm text-default-500">Preferred Days:</p>
                <div className="flex flex-wrap gap-2">
                  {post.preferredDays.map((day) => (
                    <Chip key={day} size="sm" variant="flat" color="primary">
                      {day}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}
          {/* Notes */}
          {post.notes && (
            <>
              <Divider />
              <div className="flex flex-col gap-2">
                <p className="text-sm text-default-500">Additional Notes:</p>
                <p className="text-sm text-default-700 pl-2">{post.notes}</p>
              </div>
            </>
          )}
          <Divider />
          {/* Guardian Information */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-default-700">
              Guardian Details
            </p>
            <div className="flex gap-2 pl-2">
              <div className="flex items-center gap-2 text-sm">
                <User size={16} className="text-default-400" />
                <span className="text-default-600">{post.guardian}</span>
              </div>
              |
              <div className="flex items-center gap-2 text-sm">
                <Phone size={16} className="text-default-400" />
                <span className="text-default-600">
                  {formatPhone(post.guardianPhone)}
                </span>
              </div>
            </div>
          </div>
          <Divider />
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-default-700">
                  Applications
                </span>
              </div>
              <Chip size="sm" color="primary" variant="flat">
                {post.applicantCount ?? 0} Total
              </Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 bg-warning-50 rounded-lg">
                <p className="text-xs text-warning-600">Pending</p>
                <p className="text-lg font-bold text-warning-700">
                  {post.applicationStats?.pending ?? 0}
                </p>
              </div>
              <div className="flex flex-col items-center p-2 bg-success-50 rounded-lg">
                <p className="text-xs text-success-600">Approved</p>
                <p className="text-lg font-bold text-success-700">
                  {post.applicationStats?.approved ?? 0}
                </p>
              </div>
              <div className="flex flex-col items-center p-2 bg-danger-50 rounded-lg">
                <p className="text-xs text-danger-600">Declined</p>
                <p className="text-lg font-bold text-danger-700">
                  {post.applicationStats?.declined ?? 0}
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      )}

      <Divider />

      <CardFooter className="grid grid-cols-2 gap-2 py-3 flex-wrap">
        {post.invoiceId || post.invoiceGenerated ? (
          <Button
            size="sm"
            color={post.invoiceId ? "success" : "secondary"}
            variant="flat"
            startContent={<Receipt size={16} />}
            onPress={() => onGenerateInvoice?.(post)}
            className="flex-1"
          >
            {post.invoiceId ? "Edit Invoice" : "Invoice Created"}
          </Button>
        ) : (
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            startContent={<Receipt size={16} />}
            onPress={() => onGenerateInvoice?.(post)}
            className="flex-1"
          >
            Invoice
          </Button>
        )}
        <Button
          size="sm"
          color="success"
          variant="solid"
          startContent={<Eye size={16} />}
          onPress={() => onView?.(post)}
          className="flex-1"
        >
          View
        </Button>
        <Button
          size="sm"
          color={post.status === "cancelled" ? "success" : "danger"}
          variant="solid"
          startContent={<XCircle size={16} />}
          onPress={() => onCancel?.(post)}
          className="flex-1"
        >
          {post.status === "cancelled" ? "Restore" : "Cancel"}
        </Button>
        <Button
          size="sm"
          color="primary"
          variant="solid"
          startContent={<Share2 size={16} />}
          onPress={handleShare}
          className="flex-1"
        >
          Share
        </Button>
      </CardFooter>
    </Card>
  );
};
