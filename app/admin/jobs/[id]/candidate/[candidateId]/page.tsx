"use client";

import { reportClientError } from "@/lib/client-report-error";
import { formatPhone, phoneDigits } from "@/lib/utils/phone";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { RadioGroup, Radio } from "@heroui/radio";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { User } from "@heroui/user";
import { formatDisplayDate } from "@/lib/utils/display-date";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
} from "lucide-react";

type ApplicationStatus =
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

type Application = {
  applicationId: string;
  applicantType: "teacher" | "candidate";
  applicantSnapshot: {
    name: string;
    email: string;
    phone: string;
    avatarUrl?: string | null;
    board?: string | null;
    qualification?: string | null;
    teachingExp?: string | null;
    address?: string | null;
  };
  status: ApplicationStatus;
  appliedAt: string;
  coverLetter?: string;
  dcDate?: string;
  dcMeta?: { scheduledDate: string; setAt: string };
  gcMeta?: { scheduledDate: string; setAt: string };
  declineMeta?: { reason?: string; declinedAt?: string };
  approvalMeta?: { approvedAt?: string };
};

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  status: ApplicationStatus;
  appliedDate: string;
  statusHistory: Array<{ status: string; date: string; notes?: string }>;
  board?: string | null;
  qualification?: string | null;
  teachingExp?: string | null;
  address?: string | null;
};

function buildCandidateFromApplication(app: Application): Candidate {
  const history: Candidate["statusHistory"] = [
    { status: "applied", date: app.appliedAt, notes: "Application received" },
  ];

  if (app.dcDate || app.dcMeta?.scheduledDate) {
    history.push({
      status: "DC",
      date: app.dcDate || app.dcMeta?.scheduledDate || app.appliedAt,
      notes: "Demo class scheduled",
    });
  }

  if (app.gcMeta?.scheduledDate) {
    history.push({
      status: "GC",
      date: app.gcMeta.scheduledDate,
      notes: "Guardian confirmation scheduled",
    });
  }

  if (app.approvalMeta?.approvedAt) {
    history.push({
      status: "approved",
      date: app.approvalMeta.approvedAt,
      notes: "Application approved",
    });
  }

  if (app.declineMeta?.declinedAt) {
    history.push({
      status: "decline",
      date: app.declineMeta.declinedAt,
      notes: app.declineMeta.reason,
    });
  }

  return {
    id: app.applicationId,
    name: app.applicantSnapshot.name,
    email: app.applicantSnapshot.email,
    phone: app.applicantSnapshot.phone,
    avatar: app.applicantSnapshot.avatarUrl ?? undefined,
    board: app.applicantSnapshot.board,
    qualification: app.applicantSnapshot.qualification,
    teachingExp: app.applicantSnapshot.teachingExp,
    address: app.applicantSnapshot.address,
    status: app.status,
    appliedDate: app.appliedAt,
    statusHistory: history,
  };
}

export default function JobCandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const candidateId = params.candidateId as string;
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const [candidateNotFound, setCandidateNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const fetchCandidate = async () => {
      setIsLoading(true);
      setCandidateNotFound(false);
      try {
        const res = await fetch(`/api/v1/jobs/${postId}/applications`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to fetch candidates (${res.status})`,
          );
        }

        const data = await res.json();
        const apps: Application[] = data.applications ?? [];
        const app = apps.find((item) => item.applicationId === candidateId);

        if (!active) return;

        if (!app) {
          setCandidate(null);
          setCandidateNotFound(true);
          return;
        }

        const nextCandidate = buildCandidateFromApplication(app);
        setCandidate(nextCandidate);
        setSelectedStatus(nextCandidate.status);
      } catch {
        if (active) setCandidateNotFound(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchCandidate();

    return () => {
      active = false;
    };
  }, [postId, candidateId]);

  const currentCandidate = candidate;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardBody className="py-12 flex items-center justify-center">
            <Spinner size="lg" />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (candidateNotFound || !currentCandidate) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardBody>
            <p className="text-center text-danger">Candidate not found</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const handleBack = () => {
    router.push(`/admin/jobs/${postId}`);
  };

  const handleDeleteCandidate = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/jobs/${postId}/applications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: [candidateId] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete candidate");
      }

      addToast({
        description: "Candidate deleted successfully!",
        color: "success",
      });

      // Navigate back to candidates list
      router.push(`/admin/jobs/${postId}`);
    } catch (error) {
      reportClientError(error, { feature: "admin-job-candidate" });
      addToast({
        description: "Failed to delete candidate",
        color: "danger",
      });
      setIsDeleting(false);
    } finally {
      onClose();
    }
  };

  const handleUpdateStatus = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(
        `/api/v1/jobs/${postId}/applications/${candidateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: selectedStatus,
            reason: notes || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      addToast({
        description: "Status updated successfully.",
        color: "success",
      });

      setCandidate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: selectedStatus as ApplicationStatus,
          statusHistory: [
            ...prev.statusHistory,
            {
              status: selectedStatus,
              date: new Date().toISOString(),
              notes,
            },
          ],
        };
      });

      setNotes("");
    } catch (error) {
      reportClientError(error, { feature: "admin-job-candidate" });
      addToast({
        description: "Failed to update status",
        color: "danger",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "warning";
      case "shortlisted":
        return "primary";
      case "approved":
        return "success";
      case "declined":
        return "danger";
      case "withdrawn":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "applied":
      case "pending":
        return "Pending";
      case "shortlisted":
        return "Shortlisted";
      case "approved":
        return "Approved";
      case "declined":
        return "Declined";
      case "withdrawn":
        return "Withdrawn";
      default:
        return status;
    }
  };

  // Recruitment checkpoints for jobs
  const checkpoints = [
    { id: "pending", label: "Application Received", status: "pending" },
    { id: "shortlisted", label: "Shortlisted", status: "shortlisted" },
    { id: "approved", label: "Approved", status: "approved" },
  ];

  const getCheckpointStatus = (checkpointStatus: string) => {
    const statusOrder = ["pending", "shortlisted", "approved"];
    const currentIndex = statusOrder.indexOf(
      currentCandidate.status === "declined"
        ? "pending"
        : currentCandidate.status,
    );
    const checkpointIndex = statusOrder.indexOf(checkpointStatus);

    if (checkpointIndex < currentIndex) return "completed";
    if (checkpointIndex === currentIndex) return "current";
    return "pending";
  };
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header with Back and Delete Buttons */}
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
          Delete Candidate
        </Button>
      </div>

      {/* Candidate Profile Card */}
      <Card className="mb-6">
        <CardHeader className="flex-col items-start gap-3 pb-4">
          <div className="flex items-start justify-between gap-4 w-full">
            <User
              avatarProps={{
                src: currentCandidate.avatar,
              }}
              name={currentCandidate.name}
            />
            <Chip
              size="sm"
              color={getStatusColor(currentCandidate.status)}
              variant="flat"
              className="font-semibold"
            >
              {getStatusLabel(currentCandidate.status)}
            </Chip>
          </div>
        </CardHeader>

        <Divider />

        <CardBody className="gap-4">
          {/* Contact Information - Prominent Display */}
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
                    href={`tel:${phoneDigits(currentCandidate.phone)}`}
                    className="font-semibold text-primary-600 hover:underline text-lg"
                  >
                    {formatPhone(currentCandidate.phone)}
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
                    href={`mailto:${currentCandidate.email}`}
                    className="font-semibold text-secondary-600 hover:underline"
                  >
                    {currentCandidate.email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-default-500">Board studied</p>
              <p className="font-medium">
                {currentCandidate.board || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs text-default-500">Qualification</p>
              <p className="font-medium">
                {currentCandidate.qualification || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs text-default-500">Experience</p>
              <p className="font-medium">
                {currentCandidate.teachingExp
                  ? `${currentCandidate.teachingExp} yrs`
                  : "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs text-default-500">Address</p>
              <p className="font-medium">
                {currentCandidate.address || "Not provided"}
              </p>
            </div>
          </div>

          {/* Professional Information */}
          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-default-400" />
              <div>
                <p className="text-xs text-default-500">Location</p>
                <p className="font-medium text-default-700">
                  {candidate.location}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GraduationCap size={18} className="text-default-400" />
              <div>
                <p className="text-xs text-default-500">Qualification</p>
                <p className="font-medium text-default-700">
                  {candidate.qualification}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase size={18} className="text-default-400" />
              <div>
                <p className="text-xs text-default-500">Experience</p>
                <p className="font-medium text-default-700">
                  {candidate.experience}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-default-400" />
              <div>
                <p className="text-xs text-default-500">Applied Date</p>
                <p className="font-medium text-default-700">
                  {formatDisplayDate(candidate.appliedDate)}
                </p>
              </div>
            </div>
          </div> */}

          {/* <Divider /> */}

          {/* Current Employment */}
          {/* <div className="space-y-3">
            <h3 className="text-sm font-semibold text-default-700">
              Current Employment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-default-500">Company</p>
                <p className="font-medium text-default-700">
                  {candidate.currentCompany}
                </p>
              </div>
              <div>
                <p className="text-xs text-default-500">Role</p>
                <p className="font-medium text-default-700">
                  {candidate.currentRole}
                </p>
              </div>
              <div>
                <p className="text-xs text-default-500">Notice Period</p>
                <p className="font-medium text-default-700">
                  {candidate.noticePeriod}
                </p>
              </div>
              <div>
                <p className="text-xs text-default-500">Expected Salary</p>
                <p className="font-medium text-success-600">
                  {candidate.expectedSalary}
                </p>
              </div>
            </div>
          </div> */}

          {/* <Divider /> */}

          {/* Skills */}
          {/* <div className="space-y-3">
            <h3 className="text-sm font-semibold text-default-700">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill: string) => (
                <Chip key={skill} size="sm" variant="flat" color="primary">
                  {skill}
                </Chip>
              ))}
            </div>
          </div>

          {candidate.bio && (
            <>
              <Divider />
              <div>
                <p className="text-sm font-semibold text-default-700 mb-2">
                  About
                </p>
                <p className="text-sm text-default-600">{candidate.bio}</p>
              </div>
            </>
          )} */}
        </CardBody>
      </Card>

      {/* Recruitment Process Checkpoints */}
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
              {checkpoints.map((checkpoint, index) => {
                const status = getCheckpointStatus(checkpoint.status);
                const isCompleted = status === "completed";
                const isCurrent = status === "current";

                return (
                  <div key={checkpoint.id} className="relative flex gap-4">
                    {/* Checkpoint Icon */}
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

                    {/* Checkpoint Content */}
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

                      {/* Show history for this checkpoint if it exists */}
                      {currentCandidate.statusHistory
                        .filter((h: any) => h.status === checkpoint.status)
                        .map((history: any, idx: number) => (
                          <p className="text-sm text-default-500">
                            {formatDisplayDate(history.date)}
                          </p>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update Status Card */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Update Candidate Status</h2>
        </CardHeader>
        <Divider />
        <CardBody className="gap-4">
          <RadioGroup
            label="Select Status"
            value={selectedStatus}
            onValueChange={setSelectedStatus}
          >
            <Radio value="pending">Pending</Radio>
            <Radio value="shortlisted">Shortlisted</Radio>
            <Radio value="approved">Approved</Radio>
            <Radio value="declined">Declined</Radio>
            <Radio value="withdrawn">Withdrawn</Radio>
          </RadioGroup>
          <Textarea
            label="Notes"
            placeholder="Add notes about this status update..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={3}
          />{" "}
          <Button
            color="primary"
            onPress={handleUpdateStatus}
            isLoading={isUpdating}
            isDisabled={selectedStatus === candidate.status && !notes}
          >
            Update Status
          </Button>
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Delete Candidate
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete <strong>{candidate.name}</strong>?
            </p>
            <p className="text-sm text-danger">
              This action cannot be undone. The candidate will be permanently
              removed from this job post.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteCandidate}
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
