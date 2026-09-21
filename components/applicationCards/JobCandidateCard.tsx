"use client";

import React from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { User } from "@heroui/user";
import { Phone, Eye } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import Image from "next/image";
import { formatPhone } from "@/lib/utils/phone";
import { formatDisplayDate } from "@/lib/utils/display-date";
import { useRouter } from "next/navigation";

export interface JobCandidate {
  id: string;
  name: string;
  username?: string | null;
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
  subjects?: string[];
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
  const router = useRouter();

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
              <Popover placement="bottom" showArrow>
                <PopoverTrigger>
                  <div className="cursor-pointer hover:opacity-80 transition-opacity">
                    <User
                      avatarProps={{ src: candidate.avatar }}
                      name={`${candidate.name}`}
                      description={`${candidate.phone}`}
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="px-1 py-2 flex flex-col gap-2 min-w-[120px]">
                    <Button size="sm" variant="light" onPress={() => candidate.username && router.push(`/u/${encodeURIComponent(candidate.username)}`)}>
                      View Profile
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      startContent={<Phone size={14} />}
                      onPress={() => (window.location.href = `tel:${candidate.phone}`)}
                      className="justify-start"
                    >
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => window.open(`https://wa.me/${formatPhone(candidate.phone).replace(/\D/g, "")}`)}
                      className="justify-start"
                    >
                      <Image src="/whatsapp.svg" width={14} height={14} alt="WA" />
                      WhatsApp
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
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
            <div className="flex flex-wrap gap-2 text-xs text-default-500 mb-3">
              {candidate.board && <span>Board: {candidate.board}</span>}
              {candidate.qualification && (
                <span>Qualification: {candidate.qualification}</span>
              )}
              {candidate.teachingExp && (
                <span>Experience: {candidate.teachingExp} yrs</span>
              )}
              {candidate.subjects && candidate.subjects.length > 0 && (
                <span>Subjects: {candidate.subjects.join(", ")}</span>
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
