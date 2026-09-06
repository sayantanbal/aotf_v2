"use client";

import { reportClientError } from "@/lib/client-report-error";
import { formatPhone, phoneDigits } from "@/lib/utils/phone";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { RadioGroup, Radio } from "@heroui/radio";
import { Textarea, Input } from "@heroui/input";
import { addToast } from "@heroui/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { User } from "@heroui/user";
import { formatDisplayDate } from "@/lib/utils/display-date";

type ApplicationStatus =
  | "applied"
  | "DC"
  | "GC"
  | "approved"
  | "decline"
  | "auto_declined"
  | "withdrawn";

interface Application {
  applicationId: string;
  postId: string;
  applicantType: "teacher" | "candidate";
  applicantSnapshot: {
    name: string;
    email: string;
    phone: string;
    avatarUrl?: string;
  };
  status: ApplicationStatus;
  appliedAt: string;
  dcDate?: string;
  dcMeta?: {
    scheduledDate: string;
    setAt: string;
  };
  gcMeta?: {
    scheduledDate: string;
    setAt: string;
  };
  declineMeta?: {
    reason?: string;
    declinedAt?: string;
  };
  approvalMeta?: {
    approvedAt?: string;
  };
}

interface TuitionInvoiceStatus {
  paymentStatus?: "paid" | "unpaid" | "partial";
}

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const router = useRouter();
  const { id: postId, candidateId: applicationId } = React.use(params);

  // State
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [dcDate, setDcDate] = useState<string>("");
  const [gcDate, setGcDate] = useState<string>("");
  const [approvedDate, setApprovedDate] = useState<string>("");
  const [declineReason, setDeclineReason] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">(
    "unpaid",
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isDeleting, setIsDeleting] = useState(false);

  // Starting date (approved tuitions)
  const [startingDate, setStartingDate] = useState<string>("");
  const [isSavingStartingDate, setIsSavingStartingDate] = useState(false);

  // Fetch application data
  useEffect(() => {
    const fetchApplication = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/v1/posts/${postId}/applications/${applicationId}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to fetch application (${res.status})`,
          );
        }
        const { application: app } = await res.json();
        setApplication(app);
        setSelectedStatus(app.status);
        // Pre-populate dates from existing meta if available
        const scheduledDcDate = app.dcDate || app.dcMeta?.scheduledDate;
        if (scheduledDcDate) {
          // Format for datetime-local input (YYYY-MM-DDTHH:mm)
          const dcDateTime = new Date(scheduledDcDate);
          setDcDate(dcDateTime.toISOString().slice(0, 16));
        }
        if (app.gcMeta?.scheduledDate) {
          const gcDateTime = new Date(app.gcMeta.scheduledDate);
          setGcDate(gcDateTime.toISOString().slice(0, 16));
        }
        if (app.approvalMeta?.approvedAt) {
          const approvedDateTime = new Date(app.approvalMeta.approvedAt);
          setApprovedDate(approvedDateTime.toISOString().slice(0, 16));
        }
        if (app.declineMeta?.reason) {
          setDeclineReason(app.declineMeta.reason);
        }

        const invoiceRes = await fetch(
          `/api/admin/invoices?postId=${encodeURIComponent(postId)}&limit=1`,
          { credentials: "include" },
        );
        if (invoiceRes.ok) {
          const invoiceData = await invoiceRes.json();
          const invoice = (invoiceData.invoices?.[0] ??
            null) as TuitionInvoiceStatus | null;
          setPaymentStatus(
            invoice?.paymentStatus === "paid" ? "paid" : "unpaid",
          );
        } else {
          setPaymentStatus("unpaid");
        }

        // Fetch ledger startingDate for approved tuitions
        const ledgerRes = await fetch(`/api/admin/tuitions/${postId}/ledger`, {
          credentials: "include",
        });
        if (ledgerRes.ok) {
          const ledgerData = await ledgerRes.json();
          if (ledgerData.startingDate) {
            setStartingDate(
              new Date(ledgerData.startingDate).toISOString().slice(0, 10),
            );
          }
        }
      } catch (err) {
        reportClientError(err, { feature: "admin-tuition-candidate" });
        setFetchError(
          err instanceof Error ? err.message : "Failed to fetch application",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplication();
  }, [postId, applicationId]);

  const handleBack = () => {
    router.push(`/admin/tuitions/${postId}`);
  };

  // Delete application
  const handleDeleteApplication = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/posts/${postId}/applications/${applicationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete application");
      }
      addToast({
        description: "Application deleted successfully!",
        color: "success",
      });
      router.push(`/admin/tuitions/${postId}`);
    } catch (error) {
      reportClientError(error, { feature: "admin-tuition-candidate" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete application",
        color: "danger",
      });
      setIsDeleting(false);
    } finally {
      onClose();
    }
  };

  // Update status
  const performStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === application?.status) {
      // Check if we're just updating dates for same status
      if (selectedStatus === "DC" && dcDate) {
        // Allow date update
      } else if (selectedStatus === "GC" && gcDate) {
        // Allow date update
      } else {
        addToast({ description: "No changes to update", color: "warning" });
        return;
      }
    }

    // Validation
    if (selectedStatus === "DC" && !dcDate) {
      addToast({
        description: "Please select a demo class date",
        color: "danger",
      });
      return;
    }
    if (selectedStatus === "GC" && !gcDate) {
      addToast({
        description: "Please select a guardian confirmation date",
        color: "danger",
      });
      return;
    }
    if (selectedStatus === "decline" && !declineReason.trim()) {
      addToast({
        description: "Please provide a reason for declining",
        color: "danger",
      });
      return;
    }

    if (selectedStatus === "approved" && !approvedDate) {
      addToast({
        description: "Please select an approval date",
        color: "danger",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const body: Record<string, unknown> = { status: selectedStatus };
      if (selectedStatus === "DC" && dcDate) {
        body.dcDate = new Date(dcDate).toISOString();
      }
      if (selectedStatus === "GC" && gcDate) {
        body.gcDate = new Date(gcDate).toISOString();
      }
      if (selectedStatus === "decline") {
        body.reason = declineReason.trim();
      }
      if (selectedStatus === "approved") {
        body.approvedAt = new Date(approvedDate).toISOString();
      }

      console.log("[Admin Update]", {
        selectedStatus,
        dcDate,
        gcDate,
        body,
      });

      const res = await fetch(
        `/api/v1/posts/${postId}/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }

      const { application: updated } = await res.json();
      console.log("[Admin Update Response]", {
        status: updated.status,
        dcDate: updated.dcDate,
        dcMeta: updated.dcMeta,
        gcMeta: updated.gcMeta,
      });

      setApplication(updated);
      setSelectedStatus(updated.status);

      // Re-populate dates from the updated application
      const updatedDcDate = updated.dcDate || updated.dcMeta?.scheduledDate;
      if (updatedDcDate) {
        const dcDateTime = new Date(updatedDcDate);
        setDcDate(dcDateTime.toISOString().slice(0, 16));
      } else {
        setDcDate("");
      }

      if (updated.gcMeta?.scheduledDate) {
        const gcDateTime = new Date(updated.gcMeta.scheduledDate);
        setGcDate(gcDateTime.toISOString().slice(0, 16));
      } else {
        setGcDate("");
      }

      if (updated.declineMeta?.reason) {
        setDeclineReason(updated.declineMeta.reason);
      } else {
        setDeclineReason("");
      }

      addToast({
        description: "Status updated successfully!",
        color: "success",
      });
    } catch (error) {
      reportClientError(error, { feature: "admin-tuition-candidate" });
      addToast({
        description:
          error instanceof Error ? error.message : "Failed to update status",
        color: "danger",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async () => {
    await performStatusUpdate();
  };

  // Save starting date
  const handleSaveStartingDate = async () => {
    setIsSavingStartingDate(true);
    try {
      const res = await fetch(`/api/admin/tuitions/${postId}/starting-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startingDate: startingDate
            ? new Date(startingDate).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save starting date");
      }
      addToast({ description: "Starting date saved!", color: "success" });
    } catch (error) {
      reportClientError(error, { feature: "admin-tuition-candidate" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : "Failed to save starting date",
        color: "danger",
      });
    } finally {
      setIsSavingStartingDate(false);
    }
  };

  // Helper functions
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
        return "Auto Declined";
      case "withdrawn":
        return "Withdrawn";
      default:
        return status;
    }
  };

  // Checkpoints for recruitment process
  const checkpoints = useMemo(() => {
    if (!application) return [];

    const points = [
      {
        id: "applied",
        label: "Application Received",
        date: application.appliedAt,
        status: "applied",
      },
      {
        id: "DC",
        label: "Demo Class",
        date: application.dcDate || application.dcMeta?.scheduledDate,
        status: "DC",
      },
      {
        id: "GC",
        label: "Guardian Confirmed",
        date: application.gcMeta?.scheduledDate,
        status: "GC",
      },
      {
        id: "approved",
        label: "Approved",
        date: application.approvalMeta?.approvedAt,
        status: "approved",
      },
      {
        id: "payment",
        label: "Payment Status",
        date: undefined,
        status: "payment",
        paymentLabel: paymentStatus === "paid" ? "Paid" : "Unpaid",
      },
    ];
    return points;
  }, [application, paymentStatus]);

  const getCheckpointStatus = (checkpointStatus: string) => {
    if (!application) return "pending";
    if (checkpointStatus === "payment") {
      return paymentStatus === "paid" ? "completed" : "pending";
    }
    const statusOrder = ["applied", "DC", "GC", "approved"];
    const currentIndex = statusOrder.indexOf(application.status);
    const checkpointIndex = statusOrder.indexOf(checkpointStatus);

    if (application.status === "approved" && checkpointStatus === "approved") {
      return "completed";
    }

    // Handle terminal states
    if (
      ["decline", "auto_declined", "withdrawn"].includes(application.status)
    ) {
      if (checkpointIndex <= statusOrder.indexOf("applied")) return "completed";
      return "pending";
    }

    if (checkpointIndex < currentIndex) return "completed";
    if (checkpointIndex === currentIndex) return "current";
    return "pending";
  };

  // Min datetime for date inputs (now)
  const minDateTime = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  // Check if status can be changed
  const isTerminalState =
    application?.status === "decline" ||
    application?.status === "auto_declined" ||
    application?.status === "withdrawn";

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-2 max-w-4xl">
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError || !application) {
    return (
      <div className="container mx-auto px-2 max-w-4xl">
        <Button
          size="sm"
          variant="light"
          startContent={<ArrowLeft size={18} />}
          onPress={handleBack}
          className="mb-4"
        >
          Back to Candidates
        </Button>
        <Card className="bg-danger-50">
          <CardBody className="py-10 text-center">
            <p className="text-danger">
              {fetchError || "Application not found"}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const applicantTypeLabel =
    application.applicantType === "teacher" ? "Teacher" : "Candidate";

  return (
    <div className="container mx-auto px-2 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          size="sm"
          variant="light"
          startContent={<ArrowLeft size={18} />}
          onPress={handleBack}
        >
          Back to Candidates
        </Button>
        <Button
          size="sm"
          color="danger"
          variant="flat"
          startContent={<Trash2 size={18} />}
          onPress={onOpen}
        >
          Delete Application
        </Button>
      </div>

      {/* Candidate Profile Card */}
      <Card className="mb-6">
        <CardHeader className="flex-col items-start gap-3 pb-4">
          <div className="flex justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <User
                avatarProps={{ src: application.applicantSnapshot.avatarUrl }}
                name={application.applicantSnapshot.name}
                description={`${application.applicantSnapshot.email}`}
              />
            </div>
            <Chip
              size="sm"
              color={getStatusColor(application.status)}
              variant="flat"
            >
              {getStatusLabel(application.status)}
            </Chip>
          </div>
        </CardHeader>

        <Divider />

        <CardBody className="gap-4">
          {/* Contact Information */}
          <div className="bg-primary-50 dark:bg-primary-900/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-default-700 mb-3">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Phone size={18} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Phone Number</p>
                  <a
                    href={`tel:${phoneDigits(application.applicantSnapshot.phone)}`}
                    className="font-semibold text-primary-600 hover:underline text-lg"
                  >
                    {formatPhone(application.applicantSnapshot.phone)}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
                  <Mail size={18} className="text-secondary-600" />
                </div>
                <div>
                  <p className="text-xs text-default-500">Email Address</p>
                  <a
                    href={`mailto:${application.applicantSnapshot.email}`}
                    className="font-semibold text-secondary-600 hover:underline"
                  >
                    {application.applicantSnapshot.email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Applied Date */}
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-default-400" />
            <div>
              <p className="text-xs text-default-500">Applied Date</p>
              <p className="font-medium text-default-700">
                {formatDisplayDate(application.appliedAt)}
              </p>
            </div>
          </div>

          {/* Decline Reason if declined */}
          {(application.status === "decline" ||
            application.status === "auto_declined") &&
            application.declineMeta?.reason && (
              <div className="bg-danger-50 dark:bg-danger-900/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-danger-700 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Decline Reason
                </h3>
                <p className="text-sm text-danger-600">
                  {application.declineMeta.reason}
                </p>
              </div>
            )}
        </CardBody>
      </Card>

      {/* Recruitment Process */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-bold">Recruitment Process</h2>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-default-200" />

            {/* Checkpoints */}
            <div className="space-y-6">
              {checkpoints.map((checkpoint) => {
                const status = getCheckpointStatus(checkpoint.status);
                const isCompleted = status === "completed";
                const isCurrent = status === "current";

                return (
                  <div key={checkpoint.id} className="relative flex gap-4">
                    <div className="relative z-10">
                      {isCompleted ? (
                        <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center">
                          <CheckCircle2 size={24} className="text-white" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center animate-pulse">
                          <Clock size={24} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-default-200 flex items-center justify-center">
                          <Circle size={24} className="text-default-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <h3
                        className={`font-semibold ${
                          isCompleted || isCurrent
                            ? "text-default-900"
                            : "text-default-400"
                        }`}
                      >
                        {checkpoint.label}
                      </h3>
                      {checkpoint.id === "payment" && (
                        <p
                          className={`text-sm font-medium ${paymentStatus === "paid" ? "text-success-600" : "text-danger-500"}`}
                        >
                          {checkpoint.paymentLabel}
                        </p>
                      )}
                      {checkpoint.date && (
                        <p className="text-sm text-default-500">
                          {checkpoint.id === "DC" || checkpoint.id === "GC"
                            ? new Date(checkpoint.date).toLocaleString(
                                "en-IN",
                                {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )
                            : formatDisplayDate(checkpoint.date)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update Status Card */}
      {!isTerminalState && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Update Candidate Status</h2>
          </CardHeader>
          <Divider />
          <CardBody className="gap-4">
            <RadioGroup
              label="Select Status"
              value={selectedStatus}
              onValueChange={(val) => {
                setSelectedStatus(val);
                // Clear date fields when changing status
                if (val !== "DC") setDcDate("");
                if (val !== "GC") setGcDate("");
                if (val !== "approved") setApprovedDate("");
                if (val !== "decline") setDeclineReason("");
              }}
            >
              <Radio value="applied">Applied</Radio>
              <Radio value="DC">Demo Class (DC)</Radio>
              <Radio value="GC">Guardian Confirmed (GC)</Radio>
              <Radio value="approved">Approved</Radio>
              <Radio value="decline">Decline</Radio>
            </RadioGroup>

            {/* DC Date Input */}
            {selectedStatus === "DC" && (
              <Input
                type="datetime-local"
                label="Demo Class Date & Time"
                placeholder="Select demo class date"
                value={dcDate}
                onChange={(e) => setDcDate(e.target.value)}
                min={minDateTime}
                isRequired
                description="Select a future date for the demo class"
              />
            )}

            {/* GC Date Input */}
            {selectedStatus === "GC" && (
              <Input
                type="datetime-local"
                label="Guardian Confirmation Date"
                placeholder="Select GC date"
                value={gcDate}
                onChange={(e) => setGcDate(e.target.value)}
                min={minDateTime}
                isRequired
                description="Select a future date for guardian confirmation"
              />
            )}

            {/* Approved Date Input */}
            {selectedStatus === "approved" && (
              <Input
                type="datetime-local"
                label="Approval Date"
                placeholder="Select approval date"
                value={approvedDate}
                onChange={(e) => setApprovedDate(e.target.value)}
                isRequired
                description="Select the date the application was approved"
              />
            )}

            {/* Decline Reason */}
            {selectedStatus === "decline" && (
              <Textarea
                label="Decline Reason"
                placeholder="Explain why this application is being declined..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                minRows={3}
                isRequired
                description="This message will be visible to the applicant"
              />
            )}

            <Button
              color="primary"
              onPress={handleUpdateStatus}
              isLoading={isUpdating}
              isDisabled={
                (selectedStatus === application.status &&
                  selectedStatus !== "DC" &&
                  selectedStatus !== "GC" &&
                  selectedStatus !== "approved") ||
                (selectedStatus === "DC" && !dcDate) ||
                (selectedStatus === "GC" && !gcDate) ||
                (selectedStatus === "approved" && !approvedDate) ||
                (selectedStatus === "decline" && !declineReason.trim())
              }
            >
              Update Status
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Terminal State Notice */}
      {isTerminalState && (
        <Card className="bg-default-50">
          <CardBody className="py-6 text-center">
            <XCircle size={48} className="mx-auto mb-3 text-default-400" />
            <p className="text-default-600">
              This application is in a terminal state (
              {getStatusLabel(application.status)}) and cannot be updated.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Starting Date — shown only for approved applications */}
      {application.status === "approved" && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar size={20} />
              Starting Date
            </h2>
          </CardHeader>
          <Divider />
          <CardBody className="gap-4">
            <p className="text-sm text-default-500">
              Set the date this tuition will begin. This will be synced to the
              Tuitions sheet automatically.
            </p>
            <div className="flex items-end gap-3">
              <Input
                id="starting-date-input"
                type="date"
                label="Starting Date"
                placeholder="Select starting date"
                value={startingDate}
                onChange={(e) => setStartingDate(e.target.value)}
                className="max-w-xs"
              />
              <Button
                id="save-starting-date-btn"
                color="primary"
                onPress={handleSaveStartingDate}
                isLoading={isSavingStartingDate}
                isDisabled={!startingDate}
              >
                Save
              </Button>
              {startingDate && (
                <Button
                  variant="light"
                  color="danger"
                  onPress={() => {
                    setStartingDate("");
                    handleSaveStartingDate();
                  }}
                  isDisabled={isSavingStartingDate}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Delete Application</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete the application from{" "}
              <strong>{application.applicantSnapshot.name}</strong>?
            </p>
            <p className="text-sm text-danger">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteApplication}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
