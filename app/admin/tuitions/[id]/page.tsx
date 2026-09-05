"use client";

import { reportClientError } from "@/lib/client-report-error";
import { formatPhone } from "@/lib/utils/phone";
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
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
  CandidateCard,
  Candidate,
} from "@/components/applicationCards/TuitionCandidateCard";
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
  LocateIcon,
  MapPin,
  PhoneCall,
  MessageCircle,
  Phone,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import Image from "next/image";
interface TuitionPostData {
  _id: string;
  postId: string;
  enquiryReferenceId?: string | null;
  guardianName: string;
  guardianPhone: string;
  students: {
    className: string;
    board: string;
    subjects: string[];
  }[];
  classType: string;
  frequencyPerWeek: number;
  preferredDays: string[];
  preferredTime: string;
  location: string;
  monthlyBudget: number;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function ViewPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: postId } = React.use(params);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [postData, setPostData] = useState<TuitionPostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sanitizePhoneNumber = (phoneNumber?: string) => {
    const trimmed = phoneNumber?.trim() ?? "";
    if (!trimmed) return { dialer: null, whatsapp: null };

    const dialer = trimmed.replace(/[^\d+]/g, "");
    const digitsOnly = trimmed.replace(/\D/g, "");

    if (!digitsOnly) {
      return { dialer: null, whatsapp: null };
    }

    const whatsapp = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

    return {
      dialer: dialer || null,
      whatsapp,
    };
  };

  const openGuardianDialer = () => {
    const phoneTargets = sanitizePhoneNumber(postData?.guardianPhone);
    if (!phoneTargets.dialer) {
      addToast({
        description: "No valid phone number available",
        color: "danger",
      });
      return;
    }

    window.location.href = `tel:${phoneTargets.dialer}`;
  };

  const openGuardianWhatsApp = () => {
    const phoneTargets = sanitizePhoneNumber(postData?.guardianPhone);
    if (!phoneTargets.whatsapp) {
      addToast({
        description: "No valid WhatsApp number available",
        color: "danger",
      });
      return;
    }

    window.open(
      `https://wa.me/${phoneTargets.whatsapp}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  useEffect(() => {
    const fetchPostAndApplications = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // Fetch post details and applications in parallel
        const [postRes, appsRes] = await Promise.all([
          fetch(`/api/v1/posts/${postId}`),
          fetch(`/api/v1/posts/${postId}/applications`),
        ]);

        if (!postRes.ok) {
          const data = await postRes.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to fetch post (${postRes.status})`,
          );
        }
        const { post } = await postRes.json();
        setPostData(post);

        if (appsRes.ok) {
          const appsData = await appsRes.json();
          const mapped: Candidate[] = (appsData.applications ?? []).map(
            (app: Record<string, any>) => ({
              id: app.applicationId ?? app._id,
              name: app.applicantSnapshot?.name ?? "Unknown",
              email: app.applicantSnapshot?.email ?? "",
              phone: app.applicantSnapshot?.phone ?? "",
              avatar: app.applicantSnapshot?.avatarUrl ?? undefined,
              applicantType: app.applicantType,
              status: app.status,
              appliedDate: app.appliedAt ?? app.createdAt,
              coverLetter: app.coverLetter,
              board: app.applicantSnapshot?.board ?? null,
              qualification: app.applicantSnapshot?.qualification ?? null,
              teachingExp: app.applicantSnapshot?.teachingExp ?? null,
              address: app.applicantSnapshot?.address ?? null,
            }),
          );
          setCandidates(mapped);
        }
      } catch (err) {
        reportClientError(err, { feature: "admin-tuition-detail" });
        setFetchError(
          err instanceof Error ? err.message : "Failed to fetch post",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchPostAndApplications();
  }, [postId]);

  const handleViewDetails = (candidate: Candidate) => {
    router.push(`/admin/tuitions/${postId}/candidate/${candidate.id}`);
  };

  const handleBack = () => {
    router.push("/admin/tuitions");
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

      const res = await fetch(`/api/v1/posts/${postId}/applications`, {
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
      reportClientError(error, { feature: "admin-tuition-detail" });
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
    const hasDC = candidates.some((c) => c.status === "DC");
    const hasGC = candidates.some((c) => c.status === "GC");

    const approved = candidates.filter((c) => c.status === "approved");
    const inDC = candidates.filter((c) => c.status === "DC");
    const inGC = candidates.filter((c) => c.status === "GC");
    const applied = candidates.filter((c) => c.status === "applied");
    const declined = candidates.filter(
      (c) => c.status === "decline" || c.status === "auto_declined",
    );
    const withdrawn = candidates.filter((c) => c.status === "withdrawn");

    // Determine waiting list or declined list
    let waitingListLabel = "Waiting List";
    let waitingListCandidates = [...applied];

    if (hasApproved) {
      // If someone is approved, all others go to declined
      waitingListLabel = "Declined Applicants";
      waitingListCandidates = [
        ...applied,
        ...inDC.filter((c) => c.id !== approved[0]?.id),
        ...inGC.filter((c) => c.id !== approved[0]?.id),
        ...declined,
      ];
    } else if (hasDC || hasGC) {
      // If someone is in DC/GC, others are in waiting
      waitingListLabel = "Waiting List";
      waitingListCandidates = [...applied];
    }

    return {
      approved,
      inDC,
      inGC,
      waitingListLabel,
      waitingListCandidates,
      declined,
      withdrawn,
      hasApproved,
      hasDC,
      hasGC,
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
        label: "In Process",
        count:
          categorizedCandidates.inDC.length + categorizedCandidates.inGC.length,
        icon: AlertCircle,
        color: "secondary",
      },
      {
        label: "Approved",
        count: categorizedCandidates.approved.length,
        icon: CheckCircle,
        color: "success",
      },
    ];
  };
  return (
    <div className="container mx-auto px-4 max-w-7xl space-y-3">
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
            onPress={() => router.push("/admin/tuitions")}
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
          {/* Header with Back and Delete Buttons */}
          <div className="flex items-center justify-between mb-4">
            <Button
              size="sm"
              variant="light"
              startContent={<ArrowLeft size={18} />}
              onPress={handleBack}
              className="p-0"
            >
              Back to Posts
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-2">
            <Card className="w-full">
              <CardHeader className="flex-col items-start gap-3 py-2">
                <div className="flex flex-col justify-between w-full">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-default-400">
                        Post ID: {postData.postId}
                      </p>
                      {postData.enquiryReferenceId && (
                        <p className="text-xs text-default-500">
                          Enquiry Ref: {postData.enquiryReferenceId}
                        </p>
                      )}
                    </div>
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

                  <div className="flex-1">
                    <h1 className="text-lg font-bold text-default-900">
                      {postData.students
                        .map(
                          (s) =>
                            `${s.subjects.map((sub) => sub.toUpperCase()).join(", ")} | Class - ${s.className} (${s.board.toUpperCase()})`,
                        )
                        .join(" | ")}
                    </h1>
                  </div>
                  <p className="text-xs text-default-500 flex items-center gap-1">
                    <MapPin size={16} /> {postData.location}
                  </p>
                </div>

                <div className="flex flex-col w-full">
                  <div className="flex items-center gap-1">
                    <span className="text-default-500">Guardian:</span> <br />
                    <span className="font-medium text-sm">
                      {postData.guardianName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-default-500">Phone:</span> <br />
                    <span className="font-medium text-sm">
                      {formatPhone(postData.guardianPhone)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-default-500">Monthly Fees:</span>{" "}
                    <br />
                    <span className="font-medium text-sm text-success">
                      {postData.monthlyBudget
                        ? `₹${postData.monthlyBudget.toLocaleString()}`
                        : "To be decided"}
                    </span>
                  </div>
                </div>
              </CardHeader>

              {/* Two button call and whats */}
              <CardFooter className="flex flex-col items-start py-0 pb-2">
                <p className="text-md font-bold text-default-500">
                  {" "}
                  Contact Guardian:{" "}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-1 w-full">
                  <Button
                    size="sm"
                    color="primary"
                    startContent={<Phone size={16} />}
                    onPress={openGuardianDialer}
                  >
                    Call
                  </Button>
                  <Button
                    size="sm"
                    color="secondary"
                    startContent={
                      <Image
                        src="/whatsapp.svg"
                        alt="WhatsApp"
                        width={16}
                        height={16}
                        className="text-green-500"
                      />
                    }
                    onPress={openGuardianWhatsApp}
                  >
                    WhatsApp
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
              {getStatsData().map((stat) => (
                <Card key={stat.label}>
                  <CardBody className="flex flex-row items-center gap-3 p-2">
                    <div className="flex-1 text-center">
                      <p className="text-md font-bold text-default-900">
                        {stat.count}
                      </p>
                      <p className="text-xs text-default-500">{stat.label}</p>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

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
                    variant="light"
                    startContent={<X size={18} />}
                    onPress={exitSelectionMode}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>

          <Divider />

          {/* Applicants Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Approved Applicants */}
              {categorizedCandidates.approved.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle size={20} className="text-success" />
                    <h2 className="text-xl font-semibold">
                      Approved Applicant
                    </h2>
                    <Chip size="sm" color="success" variant="flat">
                      {categorizedCandidates.approved.length}
                    </Chip>
                  </div>
                  <div className="space-y-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {categorizedCandidates.approved.map((candidate) => (
                      <CandidateCard
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

              {/* In Demo Class (DC) */}
              {categorizedCandidates.inDC.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle size={20} className="text-primary" />
                    <h2 className="text-xl font-semibold">Demo Class (DC)</h2>
                    <Chip size="sm" color="primary" variant="flat">
                      {categorizedCandidates.inDC.length}
                    </Chip>
                  </div>
                  <div className="space-y-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {categorizedCandidates.inDC.map((candidate) => (
                      <CandidateCard
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
            </div>

            {/* In Guardian Call (GC) */}
            {categorizedCandidates.inGC.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={20} className="text-secondary" />
                  <h2 className="text-xl font-semibold">Guardian Call (GC)</h2>
                  <Chip size="sm" color="secondary" variant="flat">
                    {categorizedCandidates.inGC.length}
                  </Chip>
                </div>
                <div className="space-y-3">
                  {categorizedCandidates.inGC.map((candidate) => (
                    <CandidateCard
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

            {/* Waiting List / Declined List */}
            {categorizedCandidates.waitingListCandidates.length > 0 && (
              <div>
                <Accordion className="underlined">
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {categorizedCandidates.waitingListCandidates.map(
                        (candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onViewDetails={handleViewDetails}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(candidate.id)}
                            onSelectionChange={handleSelectionChange}
                          />
                        ),
                      )}
                    </div>
                  </AccordionItem>
                </Accordion>
              </div>
            )}

            {/* Withdrawn Applicants */}
            {categorizedCandidates.withdrawn.length > 0 && (
              <div>
                <Accordion variant="bordered">
                  <AccordionItem
                    key="2"
                    aria-label="Withdrawn Applicants"
                    title={
                      <div className="flex items-center gap-2">
                        <XCircle size={20} className="text-default-400" />
                        <span className="font-semibold">
                          Withdrawn Applicants
                        </span>
                        <Chip size="sm" color="default" variant="flat">
                          {categorizedCandidates.withdrawn.length}
                        </Chip>
                      </div>
                    }
                  >
                    {" "}
                    <div className="space-y-3 pt-2">
                      {categorizedCandidates.withdrawn.map((candidate) => (
                        <CandidateCard
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
            )}
          </div>

          {/* No Applicants */}
          {candidates.length === 0 && (
            <Card>
              <CardBody className="py-10 text-center">
                <AlertCircle
                  size={48}
                  className="mx-auto text-default-300 mb-4"
                />
                <p className="text-default-500">
                  No applicants have applied for this tuition post yet.
                </p>
              </CardBody>
            </Card>
          )}

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
                      from this tuition post?
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete{" "}
                      <strong>all {candidates.length} application(s)</strong>{" "}
                      from this tuition post?
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
