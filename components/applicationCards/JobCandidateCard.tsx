"use client";

import React from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { User } from "@heroui/user";
import { Phone, Eye } from "lucide-react";
import { formatPhone } from "@/lib/utils/phone";
import { formatDisplayDate } from "@/lib/utils/display-date";

export interface JobCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  applicantType?: "teacher" | "candidate";
  avatar?: string;
  status:
    | "applied"
    | "pending"
    | "shortlisted"
    | "approved"
    | "decline"
    | "declined"
    | "auto_declined"
    | "withdrawn";
  appliedDate: string;
  coverLetter?: string;
  board?: string | null;
  qualification?: string | null;
  teachingExp?: string | null;
  address?: string | null;
}

interface JobCandidateCardProps {
  candidate: JobCandidate;
  onViewDetails: (candidate: JobCandidate) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export const JobCandidateCard: React.FC<JobCandidateCardProps> = ({
  candidate,
  onViewDetails,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}) => {
  const getStatusColor = (
    status: string,
  ): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    switch (status) {
      case "applied":
      case "pending":
      case "shortlisted":
        return "warning";
      case "approved":
        return "success";
      case "decline":
      case "declined":
      case "auto_declined":
        return "danger";
      case "withdrawn":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "applied":
      case "pending":
        return "Pending";
      case "shortlisted":
        return "Shortlisted";
      case "approved":
        return "Approved";
      case "decline":
      case "declined":
        return "Declined";
      case "auto_declined":
        return "Auto Declined";
      case "withdrawn":
        return "Withdrawn";
      default:
        return status;
    }
  };

  const applicantTypeLabel =
    candidate.applicantType === "teacher" ? "Teacher" : "Candidate";

  return (
    <Card
      className={`w-full hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-danger" : ""}`}
    >
      <CardBody className="p-4">
        <div className="space-y-3">
          {/* Avatar */}
          <div className="flex justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              {selectionMode && (
                <Checkbox
                  isSelected={isSelected}
                  onValueChange={(val) =>
                    onSelectionChange?.(candidate.id, val)
                  }
                  color="danger"
                  size="sm"
                />
              )}
              <User
                avatarProps={{
                  src: candidate.avatar,
                }}
                name={candidate.name}
                description={`${candidate.email}`}
              />
            </div>
            <Chip
              size="sm"
              color={getStatusColor(candidate.status)}
              variant="flat"
            >
              {getStatusLabel(candidate.status)}
            </Chip>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-default-600 mb-3">
              <Phone size={14} />
              <span>{formatPhone(candidate.phone)}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-default-500 mb-3">
              {candidate.board && <span>Board: {candidate.board}</span>}
              {candidate.qualification && (
                <span>Qualification: {candidate.qualification}</span>
              )}
              {candidate.teachingExp && (
                <span>Experience: {candidate.teachingExp} yrs</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-default-400">
                Applied: {formatDisplayDate(candidate.appliedDate)}
              </p>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<Eye size={16} />}
                onPress={() => onViewDetails(candidate)}
              >
                View Details
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default JobCandidateCard;
