"use client";

import { reportClientError } from "@/lib/client-report-error";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import {
  User,
  Phone,
  MessageSquare,
  Clock,
  ShieldCheck,
  RotateCcw,
  TrendingUp,
  Briefcase,
  GraduationCap,
  Copy,
  SquarePen,
  PencilLine,
} from "lucide-react";
import { FaPen, FaPhone } from "react-icons/fa";
import { Select, SelectItem } from "@heroui/select";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { formatPhone } from "@/lib/utils/phone";

export const ENQUIRY_STATUSES = [
  "new",
  "in_progress",
  "contacted",
  "unreachable",
  "resolved",
  "closed",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export type Enquiry = {
  _id: string;
  enquiryId: string;
  name: string;
  phoneNumber: string;
  query: string;
  currentStatus: EnquiryStatus;
  lastActionByAdminName?: string | null;
  lastActionByAdminRole?: string | null;
  lastAttemptNumber?: number;
  firstResponseAt?: string;
  resolvedAt?: string;
  lastActionAt?: string;
  lastActionNote?: string;
  createdAt: string;
  updatedAt: string;
};

type EnquiryCardProps = {
  enquiry: Enquiry;
  onStatusUpdated?: () => void;
};

export default function EnquiryCard({
  enquiry,
  onStatusUpdated,
}: EnquiryCardProps) {
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCall = () => {
    const phoneNumber = enquiry.phoneNumber?.trim().replace(/[^\d+]/g, "");

    if (!phoneNumber) {
      addToast({
        description: "No valid phone number available",
        color: "danger",
      });
      return;
    }

    window.location.href = `tel:${phoneNumber}`;
  };

  const handleCopyEnquiryId = async () => {
    try {
      const text = enquiry.enquiryId ?? "";
      if (!text) throw new Error("No enquiry id to copy");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      addToast({ description: "Enquiry ID copied", color: "success" });
    } catch (err: any) {
      reportClientError(err, { feature: "admin-enquiry-card" });
      addToast({
        description: err?.message || "Failed to copy",
        color: "danger",
      });
    }
  };

  const openAndLoadStatus = () => {
    setSelectedStatus(enquiry.currentStatus);
    // load previous notes if present on the enquiry object
    setNotes(enquiry.lastActionNote ?? "");
    onOpen();
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedStatus("");
      setNotes("");
    }
  }, [isOpen]);

  const handleCreatePost = (type: "job" | "tuition") => {
    // Navigate to the create form page with enquiry ID and type
    router.push(`/admin/enquiries/${enquiry._id}?type=${type}`);
  };

  const handleStatusUpdate = async (onClose: () => void) => {
    if (!selectedStatus) {
      addToast({ description: "Please select a status", color: "danger" });
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/v1/enquiry/${enquiry._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: selectedStatus,
          action: `Status changed from ${enquiry.currentStatus} to ${selectedStatus}`,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      addToast({
        description: "Status updated successfully",
        color: "success",
      });
      setSelectedStatus("");
      setNotes("");
      onClose();
      onStatusUpdated?.();
    } catch (err: any) {
      reportClientError(err, { feature: "admin-enquiry-card" });
      addToast({ description: err.message, color: "danger" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        placement="bottom-center"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col items-center gap-1">
                Status
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={16} />
                    <p className="text-sm text-default-600">
                      Current Status:{" "}
                      <StatusChip status={enquiry.currentStatus} />
                    </p>
                  </div>
                  <MetaRow
                    icon={<Clock size={16} />}
                    label="Last Action At"
                    value={formatDate(enquiry.lastActionAt)}
                  />
                </div>

                <Select
                  isRequired
                  label="Update Status"
                  placeholder="Select status"
                  labelPlacement="outside-left"
                  selectedKeys={selectedStatus ? [selectedStatus] : []}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as string;
                    setSelectedStatus(val);
                  }}
                >
                  <SelectItem key="new">New</SelectItem>
                  <SelectItem key="in_progress">In Progress</SelectItem>
                  <SelectItem key="contacted">Contacted</SelectItem>
                  <SelectItem key="unreachable">Unreachable</SelectItem>
                  <SelectItem key="resolved">Resolved</SelectItem>
                  <SelectItem key="closed">Closed</SelectItem>
                </Select>

                <Textarea
                  label="Add Notes"
                  placeholder="Add any notes regarding this status update"
                  minRows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={isUpdating}
                  onPress={() => handleStatusUpdate(onClose)}
                >
                  Update
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Card className="w-full hover:shadow-lg transition-shadow">
        {/* Header */}
        <CardHeader className="flex items-start justify-between gap-3">
          <div className=" flex flex-col items-start">
            <div className="flex items-center gap-2">
              <p className="font-semibold tracking-wide">{enquiry.enquiryId}</p>
              <Button
                isIconOnly
                size="sm"
                color="secondary"
                variant="flat"
                onPress={handleCopyEnquiryId}
                aria-label="Copy enquiry ID"
              >
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-xs text-default-500">
              {formatDate(enquiry.createdAt)}
            </p>
          </div>

          <StatusChip status={enquiry.currentStatus} />
        </CardHeader>

        {/* Body */}
        <CardBody className="py-0">
          {/* User Info */}
          <Section
            icon={<User size={18} />}
            title="Name"
            subTitle="Phone Number"
            value={enquiry.name}
            subValue={formatPhone(enquiry.phoneNumber)}
            subIcon={<Phone size={16} />}
          />
          {/* Query */}
          <Section
            icon={<MessageSquare size={18} />}
            title="Query"
            value={enquiry.query}
            multiline
          />
          {/* Meta */}
          <div className="border-t pt-4 space-y-3">
            <MetaRow
              icon={<ShieldCheck size={16} />}
              label="Last Action By"
              value={
                enquiry.lastActionByAdminName
                  ? `${enquiry.lastActionByAdminName} ${enquiry.lastActionByAdminRole ? `(${enquiry.lastActionByAdminRole.replace("_", " ")})` : ""}`
                  : "-"
              }
            />
            <MetaRow
              icon={<Clock size={16} />}
              label="Last Action At"
              value={formatDate(enquiry.lastActionAt)}
            />
            <MetaRow
              icon={<RotateCcw size={16} />}
              label="Attempt number"
              value={String(enquiry.lastAttemptNumber ?? 0)}
            />
          </div>{" "}
        </CardBody>
        <CardFooter className="grid grid-cols-3 gap-2 justify-end">
          {/* Create Dropdown */}
          <Dropdown placement="top">
            <DropdownTrigger>
              <Button color="secondary">
                <SquarePen />
                Create
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Create Post Type"
              onAction={(key) => handleCreatePost(key as "job" | "tuition")}
            >
              <DropdownItem
                key="job"
                startContent={<Briefcase size={18} />}
                description="Create a job posting"
              >
                Job Post
              </DropdownItem>
              <DropdownItem
                key="tuition"
                startContent={<GraduationCap size={18} />}
                description="Create a tuition posting"
              >
                Tuition Post
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Button color="success" onPress={openAndLoadStatus}>
            <PencilLine />
            Update
          </Button>
          <Button color="primary" onPress={handleCall}>
            <FaPhone /> Call
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

const EnquiryModal = () => {
  return <div></div>;
};

/* ---------- Sub Components ---------- */

function StatusChip({ status }: { status: EnquiryStatus }) {
  const config: Record<
    EnquiryStatus,
    {
      color:
        | "primary"
        | "warning"
        | "success"
        | "danger"
        | "secondary"
        | "default";
      label: string;
    }
  > = {
    new: { color: "primary", label: "NEW" },
    in_progress: { color: "warning", label: "IN PROGRESS" },
    contacted: { color: "secondary", label: "CONTACTED" },
    unreachable: { color: "danger", label: "UNREACHABLE" },
    resolved: { color: "success", label: "RESOLVED" },
    closed: { color: "default", label: "CLOSED" },
  };

  const c = config[status] ?? {
    color: "default" as const,
    label: status.toUpperCase(),
  };

  return (
    <Chip color={c.color} variant="flat" size="sm">
      {c.label}
    </Chip>
  );
}

function Section({
  icon,
  title,
  subTitle,
  value,
  subValue,
  subIcon,
  multiline,
}: {
  icon: React.ReactNode;
  title: string;
  subTitle?: string;
  value: string;
  subValue?: string;
  subIcon?: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className={`grid ${subValue ? "grid-cols-2" : ""} gap-3`}>
      <div className="flex gap-3 items-start">
        <div className="text-primary">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p
            className={`text-sm text-default-600 ${
              multiline ? "leading-relaxed" : ""
            }`}
          >
            {value}
          </p>
        </div>
      </div>
      <div className="flex gap-2 items-start">
        {subValue && (
          <div className="flex gap-3 items-start">
            <div className="text-primary">{subIcon}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium">{subTitle}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-default-500">
                <span>{subValue}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-default-500">
      {icon}
      <span className="w-32">{label}</span>
      <span className="text-default-700">{value}</span>
    </div>
  );
}

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleString();
}
