"use client";

import { useEffect, useRef, useState } from "react";
import JobPost from "@/components/PostCards/JobPost";
import InlineAdCard from "@/components/InlineAdCard";

const PAGE_SIZE = 10;

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type JobItem = {
  jobId: string;
  clientName: string;
  companyType: "individual" | "company";
  title: string;
  workType: "job" | "project";
  experience?: string;
  locationType: "remote" | "onsite" | "hybrid";
  location: string;
  gender: "male" | "female" | "both" | "all";
  timing: string;
  salary?: string;
  requiredQualification?: string;
  projectType?: "one-time" | "ongoing";
  budget?: string;
  duration?: string;
  brief?: string;
  status: "open" | "closed" | "hold" | "cancelled";
  createdAt?: string | Date;
  author?: { name?: string; avatarUrl?: string | null } | null;
};

type InlineAd = {
  adId: string;
  title: string;
  adType: "image" | "text" | "html";
  placement: string;
  imageUrl?: string;
  content?: string;
  targetUrl?: string;
  advertiser: string;
};

type JobFilters = {
  search?: string;
  status?: string;
};

function buildQuery(filters: JobFilters, page: number) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") {
      params.set(key, value);
    }
  });

  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  return params.toString();
}

export default function JobInfiniteFeed({
  initialJobs,
  initialPagination,
  filters,
  featuredAd,
}: {
  initialJobs: JobItem[];
  initialPagination: Pagination;
  filters: JobFilters;
  featuredAd?: InlineAd | null;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestedPageRef = useRef(initialPagination.page);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const adInsertIndex = featuredAd ? Math.min(4, jobs.length - 1) : -1;

  useEffect(() => {
    setJobs(initialJobs);
    setPagination(initialPagination);
    setIsLoadingMore(false);
    setErrorMessage(null);
    requestedPageRef.current = initialPagination.page;
  }, [initialJobs, initialPagination]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || pagination.page >= pagination.totalPages) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoadingMore) {
          return;
        }

        setIsLoadingMore(true);
        setErrorMessage(null);

        const nextPage = pagination.page + 1;
        if (requestedPageRef.current >= nextPage) {
          setIsLoadingMore(false);
          return;
        }

        requestedPageRef.current = nextPage;
        void fetch(`/api/v1/jobs?${buildQuery(filters, nextPage)}`)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Failed to load more jobs");
            }

            return response.json() as Promise<{
              jobs: JobItem[];
              pagination: Pagination;
            }>;
          })
          .then((data) => {
            setJobs((current) => {
              const seen = new Set(current.map((job) => job.jobId));
              const merged = [...current];

              data.jobs.forEach((job) => {
                if (!seen.has(job.jobId)) {
                  merged.push(job);
                }
              });

              return merged;
            });
            setPagination(data.pagination);
          })
          .catch(() => {
            setErrorMessage("Could not load more jobs right now.");
          })
          .finally(() => {
            setIsLoadingMore(false);
          });
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filters, isLoadingMore, pagination.page, pagination.totalPages]);

  if (jobs.length === 0) {
    return <p className="mt-10 text-default-500">No jobs found</p>;
  }

  return (
    <div className="w-full max-w-md mt-6 space-y-4">
      {jobs.map((job, index) => (
        <div key={job.jobId} className="space-y-4">
          <JobPost
            jobId={job.jobId}
            clientName={job.clientName}
            companyType={job.companyType}
            title={job.title}
            workType={job.workType}
            experience={job.experience}
            locationType={job.locationType}
            location={job.location}
            gender={job.gender}
            timing={job.timing}
            salary={job.salary}
            requiredQualification={job.requiredQualification}
            projectType={job.projectType}
            budget={job.budget}
            duration={job.duration}
            brief={job.brief}
            status={job.status}
            createdAt={job.createdAt ? new Date(job.createdAt) : new Date(0)}
            createdByUserId={{
              name: job.author?.name,
              avatar: job.author?.avatarUrl,
            }}
            initialApplied={false}
            applicantCount={0}
          />

          {featuredAd && index === adInsertIndex ? (
            <InlineAdCard ad={featuredAd} />
          ) : null}
        </div>
      ))}

      {pagination.page < pagination.totalPages ? (
        <div
          ref={sentinelRef}
          className="flex flex-col items-center gap-2 py-4"
        >
          {isLoadingMore ? (
            <p className="text-sm text-default-400">Loading more jobs...</p>
          ) : (
            <p className="text-sm text-default-400">Scroll to load more</p>
          )}
          {errorMessage ? (
            <p className="text-sm text-danger">{errorMessage}</p>
          ) : null}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-default-400">
          You have reached the end.
        </p>
      )}
    </div>
  );
}
