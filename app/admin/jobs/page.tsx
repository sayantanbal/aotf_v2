"use client";

import { reportClientError } from "@/lib/client-report-error";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import AdminSearchBar, {
  FilterConfig,
} from "@/components/admin/ui/AdminSearchBar";
import DateChips from "@/components/admin/ui/DateChips";
import { jobListFilterConfigs } from "@/lib/validations/forms";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { JobPostCard, JobPost } from "@/components/admin/postcards/JobPostCard";
import { AlertTriangle, Plus } from "lucide-react";
import { addToast } from "@heroui/toast";
import { Receipt } from "lucide-react";
import JobInvoiceModal from "@/components/admin/jobs/JobInvoiceModal";

/** Map a DB job (from API) to the JobPost interface used by the card. */
function mapApiJob(j: Record<string, unknown>): JobPost {
  return {
    id: (j.jobId as string) ?? (j._id as string),
    enquiryReferenceId: (j.enquiryReferenceId as string | null) ?? undefined,
    title: j.title as string,
    workType: j.workType as JobPost["workType"],
    clientName: j.clientName as string,
    phoneNumber: j.phoneNumber as string,
    companyName: j.companyName as string | undefined,
    companyType: j.companyType as JobPost["companyType"],
    locationType: j.locationType as JobPost["locationType"],
    location: j.location as string,
    timing: j.timing as string,
    experience: (j.experience as string) ?? "",
    gender: j.gender as JobPost["gender"],
    salary: (j.salary as string) ?? "",
    requiredQualification: (j.requiredQualification as string) ?? "",
    projectType: j.projectType as JobPost["projectType"],
    budget: (j.budget as string) ?? undefined,
    duration: (j.duration as string) ?? undefined,
    brief: (j.brief as string) ?? undefined,
    status: j.status as JobPost["status"],
    commissionBasis: j.commissionBasis as JobPost["commissionBasis"],
    academyCommissionPercentage: j.academyCommissionPercentage as number,
    settledAmount: j.settledAmount as number | undefined,
    invoiceGenerated: Boolean(j.invoiceGenerated),
    invoicePaymentStatus:
      j.invoicePaymentStatus as JobPost["invoicePaymentStatus"],
    applicantCount: 0,
    createdAt: j.createdAt as string,
  };
}

const Page = () => {
  const router = useRouter();

  // Data state
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedDateChip, setSelectedDateChip] = useState("");

  // Cancel modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [cancelTarget, setCancelTarget] = useState<JobPost | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const invoiceDisclosure = useDisclosure();
  const [invoiceJob, setInvoiceJob] = useState<JobPost | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch jobs from API
  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "50");

      const res = await fetch(`/api/v1/jobs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch jobs (${res.status})`);
      }
      const data = await res.json();
      const mapped = (data.jobs ?? []).map(mapApiJob);
      setPosts(mapped);
    } catch (err) {
      reportClientError(err, { feature: "admin-jobs" });
      setFetchError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, debouncedSearch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Client-side date filtering
  const filteredPosts = useMemo(() => {
    let filtered = [...posts];

    if (selectedYear || selectedMonth || selectedDay) {
      filtered = filtered.filter((post) => {
        const jobId = post.id;
        if (!jobId || jobId.length < 10) return true;
        const day = parseInt(jobId.substring(2, 4), 10);
        const month = parseInt(jobId.substring(4, 6), 10);
        const year = parseInt("20" + jobId.substring(6, 8), 10);
        if (selectedYear && year !== parseInt(selectedYear, 10)) return false;
        if (selectedMonth && month !== parseInt(selectedMonth, 10))
          return false;
        if (selectedDay && day !== parseInt(selectedDay, 10)) return false;
        return true;
      });
    }

    // Filter by date chip (compares against createdAt)
    if (selectedDateChip) {
      filtered = filtered.filter((post) => {
        if (!post.createdAt) return false;
        return post.createdAt.slice(0, 10) === selectedDateChip;
      });
    }

    return filtered;
  }, [posts, selectedYear, selectedMonth, selectedDay, selectedDateChip]);

  const handleViewPost = (post: JobPost) =>
    router.push(`/admin/jobs/${post.id}`);
  const handleEditPost = (post: JobPost) =>
    router.push(`/admin/jobs/${post.id}/edit`);
  const handleSharePost = (_post: JobPost) => {
    /* handled inside card */
  };

  const handleCancelPost = (post: JobPost) => {
    setCancelTarget(post);
    onOpen();
  };

  const handleGenerateInvoice = (post: JobPost) => {
    setInvoiceJob(post);
    invoiceDisclosure.onOpen();
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const nextStatus =
        cancelTarget.status === "cancelled" ? "open" : "cancelled";
      const actionLabel = nextStatus === "cancelled" ? "cancel" : "restore";

      const res = await fetch(`/api/v1/jobs/${cancelTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${actionLabel} job post`);
      }

      addToast({
        description:
          nextStatus === "cancelled"
            ? "Job post cancelled successfully!"
            : "Job post restored successfully!",
        color: "success",
      });
      onClose();
      setCancelTarget(null);
      fetchJobs();
    } catch (error) {
      reportClientError(error, { feature: "admin-jobs" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : "Failed to update post status",
        color: "danger",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("");
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedDay("");
    setSelectedDateChip("");
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") setFilterStatus(value);
    else if (key === "year") setSelectedYear(value);
    else if (key === "month") setSelectedMonth(value);
    else if (key === "day") setSelectedDay(value);
  };

  // Filter values map — sourced from lib/validations/forms.ts
  const jobFilterValues: Record<string, string> = {
    status: filterStatus,
    year: selectedYear,
    month: selectedMonth,
    day: selectedDay,
  };

  return (
    <div className="container mx-auto px-4 max-w-7xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-default-900">Job Posts</h1>
      </div>

      {/* Search + Filter Bar */}
      <AdminSearchBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by title, client, location…"
        filters={jobListFilterConfigs as unknown as FilterConfig[]}
        filterValues={jobFilterValues}
        onFilterChange={handleFilterChange}
        resultCount={filteredPosts.length}
        resultLabel="job"
        onClearAll={clearFilters}
      />

      {/* Date quick-filter chips */}
      <DateChips selected={selectedDateChip} onChange={setSelectedDateChip} />

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error */}
      {fetchError && !isLoading && (
        <Card className="bg-danger-50">
          <CardBody className="py-10 text-center">
            <p className="text-danger">{fetchError}</p>
            <Button size="sm" className="mt-3" onPress={fetchJobs}>
              Retry
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Results */}
      {!isLoading && !fetchError && (
        <>
          {filteredPosts.length === 0 ? (
            <Card>
              <CardBody className="py-10 text-center">
                <p className="text-default-500">No job posts found.</p>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((post) => (
                <JobPostCard
                  key={post.id}
                  post={post}
                  onShare={handleSharePost}
                  onView={handleViewPost}
                  onEdit={handleEditPost}
                  onCancel={handleCancelPost}
                  onGenerateInvoice={handleGenerateInvoice}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          {() => {
            const willRestore = cancelTarget?.status === "cancelled";
            return (
              <>
                <ModalHeader>
                  {willRestore ? "Restore Job Post" : "Cancel Job Post"}
                </ModalHeader>
                <ModalBody>
                  <p>
                    Are you sure you want to{" "}
                    {willRestore ? "restore" : "cancel"}{" "}
                    <strong>{cancelTarget?.title}</strong> ({cancelTarget?.id})?
                  </p>
                  <p className="text-sm text-default-500">
                    {willRestore
                      ? "This will mark the post as open again."
                      : "This will mark the post as cancelled. You can restore it later."}
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button
                    color="default"
                    variant="light"
                    onPress={onClose}
                    isDisabled={isCancelling}
                  >
                    No, Keep Post
                  </Button>
                  <Button
                    color={willRestore ? "success" : "danger"}
                    onPress={confirmCancel}
                    isLoading={isCancelling}
                  >
                    {willRestore ? "Yes, Restore Post" : "Yes, Cancel Post"}
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={invoiceDisclosure.isOpen}
        onClose={invoiceDisclosure.onClose}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Receipt size={20} className="text-secondary-600" />
            Job Invoice
          </ModalHeader>
          <ModalBody>
            {invoiceJob && (
              <JobInvoiceModal
                job={invoiceJob}
                onSuccess={() => {
                  invoiceDisclosure.onClose();
                  fetchJobs();
                }}
              />
            )}
          </ModalBody>
          <ModalFooter />
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Page;
