"use client";

import React from "react";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { User } from "@heroui/user";
import {
  Eye,
  GraduationCap,
  BookOpen,
  BriefcaseBusiness,
  MapPin,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/phone";
import { useRouter } from "next/navigation";
import { formatDisplayDate } from "@/lib/utils/display-date";
export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  applicantType?: "teacher" | "candidate";
  avatar?: string;
  status:
    | "applied"
    | "DC"
    | "GC"
    | "approved"
    | "decline"
    | "auto_declined"
    | "withdrawn";
  appliedDate: string;
  coverLetter?: string;
  board?: string | null;
  qualification?: string | null;
  teachingExp?: string | null;
  address?: string | null;
}

interface CandidateCardProps {
  candidate: Candidate;
  onViewDetails: (candidate: Candidate) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({
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
        return "warning";
      case "DC":
        return "primary";
      case "GC":
        return "secondary";
      case "approved":
        return "success";
      case "decline":
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
        return "Applied";
      case "DC":
        return "Demo ✅";
      case "GC":
        return "Guardian Confirmed ✅";
      case "approved":
        return "Approved ✅";
      case "decline":
        return "Declined ❌";
      case "auto_declined":
        return "Auto Declined ❌";
      case "withdrawn":
        return "Withdrawn";
      default:
        return status;
    }
  };

  const router = useRouter();

  return (
    <Card
      className={`w-full hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-danger" : ""}`}
    >
      <CardBody className="p-2 pb-0">
        <div className="space-y-2">
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
              {/* onClick push the user to the user profile without reload using useRouter */}
              <User
                onClick={() => router.push(`/profile/${candidate.id}`)}
                style={{ cursor: "pointer" }}
                avatarProps={{
                  src: candidate.avatar,
                }}
                name={`${candidate.name}`}
                description={`${candidate.phone}`}
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
          <div className="flex flex-col min-w-0 text-sm gap-1">
            <div className="w-full flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <BookOpen size={13} className="text-default-400 shrink-0" />
                <span className="font-medium text-default-700 truncate">
                  {candidate.board?.trim() || "N/A"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <GraduationCap
                  size={13}
                  className="text-default-400 shrink-0"
                />
                <span className="font-medium text-default-700 truncate">
                  {candidate.qualification?.trim() || "N/A"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <BriefcaseBusiness
                  size={13}
                  className="text-default-400 shrink-0"
                />
                <span className="font-medium text-default-700 truncate">
                  {candidate.teachingExp?.trim() || "N/A"}{" "}
                  {candidate.teachingExp?.trim() ? "yrs exp" : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:col-span-2">
              <MapPin size={13} className="text-default-400 shrink-0" />
              <span className="font-medium text-default-700 truncate">
                {candidate.address?.trim() || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter className="flex items-center justify-between gap-2 pt-1 p-2">
        <p className="text-xs font-semibold text-default-400">
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
      </CardFooter>
    </Card>
  );
};
