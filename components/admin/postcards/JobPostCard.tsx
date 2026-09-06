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
  Briefcase,
  Calendar,
  Users,
  Share2,
  Eye,
  XCircle,
  Clock,
  Edit,
} from "lucide-react";
import { FaRupeeSign } from "react-icons/fa";
import { formatPhone } from "@/lib/utils/phone";
import {
  formatJobShare,
  shareOnWhatsApp,
  type JobShareData,
} from "@/lib/utils/share";

export interface JobPost {
  id: string; // jobId
  enquiryReferenceId?: string | null;
  workType: "job" | "project";
  title: string;
  clientName: string;
  phoneNumber: string;
  companyName?: string;
  companyType: "individual" | "company";
  locationType: "remote" | "onsite" | "hybrid";
  location: string;
  timing: string;
  experience?: string;
  gender: "male" | "female" | "both" | "all";
  salary?: string;
  requiredQualification?: string;
  projectType?: "one-time" | "ongoing";
  budget?: string;
  duration?: string;
  brief?: string;
  status: "open" | "closed" | "hold" | "cancelled";
  commissionBasis: "first_month" | "project_value";
  academyCommissionPercentage: number;
  settledAmount?: number;
  invoiceGenerated?: boolean;
  invoicePaymentStatus?: "paid" | "partial" | "unpaid";
  // Applicant data (will come from applications collection later)
  applicantCount?: number;
  applicationStats?: {
    pending: number;
    approved: number;
    declined: number;
    withdrawn: number;
    total: number;
  };
  postedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface JobPostCardProps {
  post: JobPost;
  onShare?: (post: JobPost) => void;
  onCancel?: (post: JobPost) => void;
  onView?: (post: JobPost) => void;
  onEdit?: (post: JobPost) => void;
  onGenerateInvoice?: (post: JobPost) => void;
}

const formatLocationType = (type: string) =>
  ({ remote: "Remote", onsite: "On-Site", hybrid: "Hybrid" })[type] ?? type;

const formatWorkType = (type: string) =>
  ({ job: "Job", project: "Project" })[type] ?? type;

const formatCommissionBasis = (type: string) =>
  ({ first_month: "First Month", project_value: "Project Value" })[type] ??
  type;

export const JobPostCard: React.FC<JobPostCardProps> = ({
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
        return "danger";
      case "hold":
        return "warning";
      case "cancelled":
        return "default";
      default:
        return "default";
    }
  };

  const handleShare = () => {
    const shareData: JobShareData = {
      jobId: post.id,
      title: post.title,
      companyName: post.companyType === "company" ? post.clientName : undefined,
      location: post.location,
      salary: post.salary,
      budget: post.budget,
      requiredQualification: post.requiredQualification,
      gender: post.gender,
      workType: post.workType,
    };
    shareOnWhatsApp(formatJobShare(shareData));
    onShare?.(post);
  };

  return (
    <Card className="w-full max-w-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader
        className="flex flex-col gap-3 pb-3 cursor-pointer"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex justify-between items-start w-full">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-md font-bold text-primary">{post.id}</p>
              <div className="flex items-center gap-1">
                <Chip
                  size="sm"
                  color="secondary"
                  variant="flat"
                  className="capitalize"
                >
                  {formatWorkType(post.workType)}
                </Chip>
                <Chip
                  size="sm"
                  color={getStatusColor(post.status)}
                  variant="flat"
                  className="capitalize"
                >
                  {post.status}
                </Chip>
              </div>
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

      {!isExpanded && (
        <CardBody
          className="gap-2 py-2 cursor-pointer"
          onClick={() => setIsExpanded(true)}
        >
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-default-900">{post.title}</h3>
            <div className="grid grid-cols-1 gap-1 text-sm">
              {post.experience && (
                <span className="text-default-600">
                  Experience: <strong>{post.experience} years</strong>
                </span>
              )}
              {(post.workType === "job" ? post.salary : post.budget) && (
                <span className="text-default-600">
                  <FaRupeeSign className="mr-1 inline" />
                  {post.workType === "job" ? post.salary : post.budget}
                </span>
              )}
              {post.requiredQualification && (
                <span className="text-default-600">
                  Qualification: <strong>{post.requiredQualification}</strong>
                </span>
              )}
            </div>
          </div>
        </CardBody>
      )}

      {isExpanded && (
        <CardBody className="gap-2 py-2">
          <Button
            isIconOnly
            aria-label="Edit post"
            variant="faded"
            className="absolute top-2 right-2"
            onPress={() => onEdit?.(post)}
          >
            <Edit size={16} />
          </Button>
          {/* Job Details */}
          <div className="space-y-2">
            <div>
              <h3 className="text-lg font-bold text-default-900">
                {post.title}
              </h3>
              <p className="text-sm text-default-500">
                {post.clientName}{" "}
                <span className="text-xs text-default-400 capitalize">
                  ({post.companyType})
                </span>
              </p>
            </div>
            {post.invoiceGenerated && post.invoicePaymentStatus && (
              <Chip
                size="sm"
                color={
                  post.invoicePaymentStatus === "paid"
                    ? "success"
                    : post.invoicePaymentStatus === "partial"
                      ? "secondary"
                      : "warning"
                }
                variant="flat"
                className="capitalize"
              >
                Invoice {post.invoicePaymentStatus}
              </Chip>
            )}

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {post.experience && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={16} className="text-default-400" />
                  <div>
                    <span className="text-default-500">Experience:</span>{" "}
                    <span className="font-medium text-default-700">
                      {post.experience} years
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={16} className="text-default-400" />
                <div>
                  <span className="text-default-500">Location:</span>{" "}
                  <span className="font-medium text-default-700">
                    {post.location}
                  </span>
                </div>
              </div>
              {post.workType === "job" && post.salary && (
                <div className="flex items-center gap-2 text-sm">
                  <FaRupeeSign size={16} className="text-default-400" />
                  <div>
                    <span className="text-default-500">Salary:</span>{" "}
                    <span className="font-medium text-success-600">
                      {post.salary}
                    </span>
                  </div>
                </div>
              )}
              {post.workType === "project" && post.budget && (
                <div className="flex items-center gap-2 text-sm">
                  <FaRupeeSign size={16} className="text-default-400" />
                  <div>
                    <span className="text-default-500">Budget:</span>{" "}
                    <span className="font-medium text-success-600">
                      {post.budget}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-default-400" />
                <div>
                  <span className="text-default-500">Type:</span>{" "}
                  <span className="font-medium text-default-700">
                    {formatLocationType(post.locationType)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-2 text-sm">
                <Calendar size={16} className="text-default-400 mt-0.5" />
                <div>
                  <span className="text-default-500">Timing:</span>{" "}
                  <span className="font-medium text-default-700">
                    {post.timing}
                  </span>
                </div>
              </div>
              {post.requiredQualification && (
                <div className="flex items-start gap-2 text-sm">
                  <Briefcase size={16} className="text-default-400 mt-0.5" />
                  <div>
                    <span className="text-default-500">Qualification:</span>{" "}
                    <span className="font-medium text-default-700">
                      {post.requiredQualification}
                    </span>
                  </div>
                </div>
              )}
              {post.workType === "project" && post.duration && (
                <div className="flex items-start gap-2 text-sm">
                  <Clock size={16} className="text-default-400 mt-0.5" />
                  <div>
                    <span className="text-default-500">Duration:</span>{" "}
                    <span className="font-medium text-default-700">
                      {post.duration}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Divider />

            {/* Client Contact */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-default-700">
                Client Contact:{" "}
                <span className="text-default-600">
                  {formatPhone(post.phoneNumber)}
                </span>
              </p>
            </div>

            <Divider />

            {/* Commission Info */}
            <div className="flex items-center gap-2 text-sm">
              <FaRupeeSign size={14} className="text-default-400" />
              <span className="text-default-500">Commission:</span>{" "}
              <span className="font-medium text-default-700">
                {post.academyCommissionPercentage}% (
                {formatCommissionBasis(post.commissionBasis)})
              </span>
            </div>

            {/* <Divider /> */}

            {/* Application Statistics */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-default-700">
                    Applications:
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
          </div>
        </CardBody>
      )}

      <Divider />

      <CardFooter className="grid grid-cols-2 gap-2 py-3">
        {onGenerateInvoice && (
          <Button
            size="sm"
            variant="flat"
            color="secondary"
            onPress={() => onGenerateInvoice(post)}
          >
            {post.invoiceGenerated ? "Edit Invoice" : "Invoice"}
          </Button>
        )}
        <Button
          size="sm"
          color="success"
          variant="solid"
          startContent={<Eye size={16} />}
          onPress={() => onView?.(post)}
        >
          View
        </Button>
        <Button
          size="sm"
          color={post.status === "cancelled" ? "success" : "danger"}
          variant="solid"
          startContent={<XCircle size={16} />}
          onPress={() => onCancel?.(post)}
        >
          {post.status === "cancelled" ? "Restore" : "Cancel"}
        </Button>
        <Button
          size="sm"
          color="primary"
          variant="solid"
          startContent={<Share2 size={16} />}
          onPress={handleShare}
        >
          Share
        </Button>
      </CardFooter>
    </Card>
  );
};
