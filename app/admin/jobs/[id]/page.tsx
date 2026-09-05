"use client";

import { reportClientError } from "@/lib/client-report-error";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  JobCandidateCard,
  JobCandidate,
} from "@/components/applicationCards/JobCandidateCard";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  MousePointerClick,
  X,
} from "lucide-react";
import { addToast } from "@heroui/toast";

interface JobPostData {
  _id: string;
  jobId: string;
  enquiryReferenceId?: string | null;
  workType: string;
  title: string;
  clientName: string;
  phoneNumber: string;
  companyType: string;
  locationType: string;
  location: string;
  timing: string;
  experience?: string;
  gender: string;
  salary?: string;
  requiredQualification?: string;
  projectType?: string;
  budget?: string;
  duration?: string;
  brief?: string;
  status: string;
  commissionBasis: string;
  academyCommissionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export default function ViewJobPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: postId } = React.use(params);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [postData, setPostData] = useState<JobPostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchJobAndApplications = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // Fetch job details and applications in parallel
        const [jobRes, appsRes] = await Promise.all([
          fetch(`/api/v1/jobs/${postId}`),
          fetch(`/api/v1/jobs/${postId}/applications`),
        ]);

        if (!jobRes.ok) {
          const data = await jobRes.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to fetch job (${jobRes.status})`
          );
        }
        const { job } = await jobRes.json();
        setPostData(job);

        if (appsRes.ok) {
          const appsData = await appsRes.json();
          const mapped: JobCandidate[] = (appsData.applications ?? []).map(
            (app: Record<string, any>) => ({
              id: app.applicationId ?? app._id,
              name: app.applicantSnapshot?.name ?? "Unknown",
              email: app.applicantSnapshot?.email ?? "",
              phone: app.applicantSnapshot?.phone ?? "",
              avatar: app.applicantSnapshot?.avatarUrl ?? undefined,
              applicantType: app.applicantType,
              status: app.status === "applied" ? "applied" : app.status,
              appliedDate: app.appliedAt ?? app.createdAt,
              coverLetter: app.coverLetter,
            })
          );
          setCandidates(mapped);
        }
      } catch (err) {
      reportClientError(err, { feature: "admin-job-detail" });
        setFetchError(
          err instanceof Error ? err.message : "Failed to fetch job"
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchJobAndApplications();
  }, [postId]);

  const handleViewDetails = (candidate: JobCandidate) => {
    router.push(`/admin/jobs/${postId}/candidate/${candidate.id}`);
  };

  const handleBack = () => {
    router.push("/admin/jobs");
  };

  const handleSelectionChange = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  /** Delete selected or all applications via API */
  const handleDeleteApplications = async () => {
    setIsClearing(true);
    try {
      const isSelectiveDelete =
        selectionMode &&
        selectedIds.size > 0 &&
        selectedIds.size < candidates.length;

      const body: Record<string, unknown> = {};
      if (isSelectiveDelete) {
        body.applicationIds = Array.from(selectedIds);
      }

      const res = await fetch(`/api/v1/jobs/${postId}/applications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete applications");
      }

      const { deletedCount } = await res.json();

      if (isSelectiveDelete) {
        setCandidates((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      } else {
        setCandidates([]);
      }

      setSelectedIds(new Set());
      setSelectionMode(false);

      addToast({
        description: `${deletedCount} application(s) removed successfully.`,
        color: "success",
      });

      onClose();
    } catch (error) {
      reportClientError(error, { feature: "admin-job-detail" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete applications",
        color: "danger",
      });
    } finally {
      setIsClearing(false);
    }
  };
  // Categorize candidates based on recruitment status
  const categorizedCandidates = useMemo(() => {
    const hasApproved = candidates.some((c) => c.status === "approved");

    const approved = candidates.filter((c) => c.status === "approved");
    const applied = candidates.filter((c) => c.status === "applied");
    const declined = candidates.filter(
      (c) => c.status === "decline" || c.status === "auto_declined"
    );
    const withdrawn = candidates.filter((c) => c.status === "withdrawn");

    // Determine waiting list label and candidates
    let waitingListLabel = "Waiting List";
    let waitingListCandidates = applied;

    if (hasApproved) {
      waitingListLabel = "Declined Applicants";
      waitingListCandidates = [...applied, ...declined];
    }

    return {
      approved,
      waitingListLabel,
      waitingListCandidates,
      withdrawn,
      hasApproved,
    };
  }, [candidates]);

  const getStatsData = () => {
    return [
      {
        label: "Applicants",
        count: candidates.length,
        icon: Users,
        color: "primary",
      },
      {
        label: "Pending",
        count: categorizedCandidates.waitingListCandidates.length,
        icon: Clock,
        color: "warning",
      },
      {
        label: "Approved",
        count: categorizedCandidates.approved.length,
        icon: CheckCircle,
        color: "success",
      },
      {
        label: "Withdrawn",
        count: categorizedCandidates.withdrawn.length,
        icon: XCircle,
        color: "danger",
      },
    ];
  };
  return (
    <div className="container mx-auto px-4 max-w-7xl">
      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error State */}
      {fetchError && (
        <>
          <Button
            size="sm"
            variant="light"
            startContent={<ArrowLeft size={18} />}
            onPress={() => router.push("/admin/jobs")}
            className="mb-4"
          >
            Back to Posts
          </Button>
          <Card className="bg-danger-50">
            <CardBody className="py-10 text-center">
              <p className="text-danger">{fetchError}</p>
            </CardBody>
          </Card>
        </>
      )}

      {/* Main Content */}
      {!isLoading && !fetchError && postData && (
        <>
          {/* Header with Back and Clear All Buttons */}
          <div className="space-y-3 mb-3">
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="light"
                startContent={<ArrowLeft size={18} />}
                onPress={handleBack}
              >
                Back to Posts
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Card>
                <CardHeader className="flex-col items-start gap-3 pb-4">
                  <div className="flex flex-col w-full">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm text-default-400">
                          Post ID: {postData.jobId}
                        </p>
                        {postData.enquiryReferenceId && (
                          <p className="text-xs text-default-500">
                            Enquiry Ref: {postData.enquiryReferenceId}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Chip
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="capitalize"
                        >
                          {postData.workType}
                        </Chip>
                        <Chip
                          size="sm"
                          color={
                            postData.status === "open"
                              ? "success"
                              : postData.status === "hold"
                                ? "warning"
                                : "danger"
                          }
                          variant="flat"
                          className="capitalize"
                        >
                          {postData.status}
                        </Chip>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h1 className="text-lg font-bold text-default-900">
                        {postData.title}
                      </h1>
                      <p className="text-xs text-default-500">
                        {postData.clientName}
                      </p>
                    </div>
                  </div>

                  <Divider />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1 w-full h-full">
                    <div className="flex gap-2 items-center">
                      <span className="font-medium text-sm text-default-500">
                        Location:{" "}
                      </span>
                      <span className="font-xs text-default-900">
                        {postData.location}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="font-medium text-sm text-default-500">
                        {postData.workType === "job" ? "Salary: " : "Budget: "}
                      </span>
                      <span className="font-medium text-sm text-success-600">
                        {postData.workType === "job"
                          ? postData.salary || "Not specified"
                          : postData.budget || "Not specified"}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="font-medium text-sm text-default-500">
                        Timing:{" "}
                      </span>
                      <span className="font-xs text-default-900">
                        {postData.timing}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="font-medium text-sm text-default-500">
                        Commission:{" "}
                      </span>
                      <span className="font-xs text-default-900">
                        {postData.academyCommissionPercentage}%
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Statistics Cards */}
              <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
                {getStatsData().map((stat) => {
                  return (
                    <Card key={stat.label}>
                      <CardBody className="flex flex-row items-center gap-3 p-2">
                        <div className="flex-1 text-center">
                          <p className="text-md font-bold text-default-900">
                            {stat.count}
                          </p>
                          <p className="text-xs text-default-500">
                            {stat.label}
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Applicants Sections */}
          <div className="space-y-3">
            {/* Approved Applicants */}
            {categorizedCandidates.approved.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} className="text-success" />
                  <h2 className="text-xl font-semibold">Approved Applicants</h2>
                  <Chip size="sm" color="success" variant="flat">
                    {categorizedCandidates.approved.length}
                  </Chip>
                </div>
                <div className="space-y-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {categorizedCandidates.approved.map((candidate) => (
                    <JobCandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      onViewDetails={handleViewDetails}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(candidate.id)}
                      onSelectionChange={handleSelectionChange}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 w-full">
              {candidates.length > 0 && !selectionMode && (
                <>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<MousePointerClick size={18} />}
                    onPress={() => setSelectionMode(true)}
                  >
                    Select &amp; Delete
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="solid"
                    startContent={<Trash2 size={18} />}
                    onPress={onOpen}
                  >
                    Delete All ({candidates.length})
                  </Button>
                </>
              )}
              {selectionMode && (
                <>
                  <Button size="sm" variant="flat" onPress={toggleSelectAll}>
                    {selectedIds.size === candidates.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="solid"
                    startContent={<Trash2 size={18} />}
                    isDisabled={selectedIds.size === 0}
                    onPress={onOpen}
                  >
                    Delete ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<X size={18} />}
                    onPress={exitSelectionMode}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
            {/* Waiting List / Declined List */}
            {categorizedCandidates.waitingListCandidates.length > 0 && (
              <div>
                <Accordion variant="bordered">
                  <AccordionItem
                    key="1"
                    aria-label={categorizedCandidates.waitingListLabel}
                    title={
                      <div className="flex items-center gap-2">
                        {categorizedCandidates.hasApproved ? (
                          <XCircle size={20} className="text-danger" />
                        ) : (
                          <Clock size={20} className="text-warning" />
                        )}
                        <span className="font-semibold">
                          {categorizedCandidates.waitingListLabel}
                        </span>
                        <Chip
                          size="sm"
                          color={
                            categorizedCandidates.hasApproved
                              ? "danger"
                              : "warning"
                          }
                          variant="flat"
                        >
                          {categorizedCandidates.waitingListCandidates.length}
                        </Chip>
                      </div>
                    }
                  >
                    <div className="space-y-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      {categorizedCandidates.waitingListCandidates.map(
                        (candidate) => (
                          <JobCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onViewDetails={handleViewDetails}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(candidate.id)}
                            onSelectionChange={handleSelectionChange}
                          />
                        )
                      )}
                    </div>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
            {/* Withdrawn Candidates */}
            {categorizedCandidates.withdrawn.length > 0 && (
              <div>
                <Accordion variant="bordered">
                  <AccordionItem
                    key="2"
                    aria-label="Withdrawn Candidates"
                    title={
                      <div className="flex items-center gap-2">
                        <XCircle size={20} className="text-default-400" />
                        <span className="font-semibold">
                          Withdrawn Candidates
                        </span>
                        <Chip size="sm" variant="flat">
                          {categorizedCandidates.withdrawn.length}
                        </Chip>
                      </div>
                    }
                  >
                    <div className="space-y-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      {categorizedCandidates.withdrawn.map((candidate) => (
                        <JobCandidateCard
                          key={candidate.id}
                          candidate={candidate}
                          onViewDetails={handleViewDetails}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(candidate.id)}
                          onSelectionChange={handleSelectionChange}
                        />
                      ))}
                    </div>
                  </AccordionItem>
                </Accordion>
              </div>
            )}{" "}
            {/* No Candidates */}
            {candidates.length === 0 && (
              <Card>
                <CardBody className="py-10 text-center">
                  <AlertCircle
                    size={48}
                    className="mx-auto text-default-300 mb-4"
                  />
                  <p className="text-default-500">
                    No candidates have applied for this job post yet.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Delete Applications Confirmation Modal */}
          <Modal isOpen={isOpen} onClose={onClose}>
            <ModalContent>
              <ModalHeader className="flex flex-col gap-1">
                {selectionMode &&
                selectedIds.size > 0 &&
                selectedIds.size < candidates.length
                  ? "Delete Selected Applications"
                  : "Delete All Applications"}
              </ModalHeader>
              <ModalBody>
                <p>
                  {selectionMode &&
                  selectedIds.size > 0 &&
                  selectedIds.size < candidates.length ? (
                    <>
                      Are you sure you want to delete{" "}
                      <strong>
                        {selectedIds.size} selected application(s)
                      </strong>{" "}
                      from this job post?
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete{" "}
                      <strong>all {candidates.length} application(s)</strong>{" "}
                      from this job post?
                    </>
                  )}
                </p>
                <p className="text-sm text-danger">
                  ⚠️ This action cannot be undone. The application(s) will be
                  permanently removed.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="light"
                  onPress={onClose}
                  isDisabled={isClearing}
                >
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={handleDeleteApplications}
                  isLoading={isClearing}
                >
                  {selectionMode &&
                  selectedIds.size > 0 &&
                  selectedIds.size < candidates.length
                    ? `Delete ${selectedIds.size} Selected`
                    : "Delete All"}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </>
      )}
    </div>
  );
}
