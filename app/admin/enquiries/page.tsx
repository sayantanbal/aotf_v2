"use client";

import { reportClientError } from "@/lib/client-report-error";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from "@heroui/modal";
import { Plus } from "lucide-react";
import EnquiryCard, { Enquiry } from "@/components/admin/enquiries/EnquiryCard";
import { Spinner } from "@heroui/spinner";
import AdminSearchBar, {
  FilterConfig,
} from "@/components/admin/ui/AdminSearchBar";
import EnquiryForm from "@/components/enquiry/EnquiryForm";
import { motion } from "motion/react";
import DateChips from "@/components/admin/ui/DateChips";

const enquiryFilterConfigs: FilterConfig[] = [
  {
    key: "status",
    label: "Status",
    placeholder: "All Statuses",
    options: [
      { key: "new", label: "New" },
      { key: "in_progress", label: "In Progress" },
      { key: "contacted", label: "Contacted" },
      { key: "unreachable", label: "Unreachable" },
      { key: "resolved", label: "Resolved" },
      { key: "closed", label: "Closed" },
    ],
  },
];

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedDateChip, setSelectedDateChip] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/enquiry");
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await res.json() : null;

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to fetch enquiries (${res.status})`
        );
      }

      if (!isJson || !data) {
        throw new Error("Unexpected server response while loading enquiries");
      }

      setEnquiries(data.enquiries);
    } catch (err: any) {
      reportClientError(err, { feature: "admin-enquiries" });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((enq) => {
      if (filterStatus && enq.currentStatus !== filterStatus) return false;
      if (selectedDateChip && enq.createdAt?.slice(0, 10) !== selectedDateChip) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        enq.name?.toLowerCase().includes(q) ||
        enq.phoneNumber?.includes(q) ||
        enq.query?.toLowerCase().includes(q)
      );
    });
  }, [enquiries, searchQuery, filterStatus, selectedDateChip]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-danger">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-default-900">Enquiries</h1>
      </div>

      <motion.button
        onClick={onOpen}
        aria-label="Create enquiry"
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-xl hover:shadow-2xl transition-shadow"
      >
        <Plus size={26} />
      </motion.button>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="xl" placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Create Enquiry</ModalHeader>
              <ModalBody>
                <EnquiryForm
                  onSuccess={() => {
                    fetchEnquiries();
                    onClose();
                  }}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <AdminSearchBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by name, phone or query…"
        filters={enquiryFilterConfigs}
        filterValues={{ status: filterStatus }}
        onFilterChange={(key, value) => {
          if (key === "status") setFilterStatus(value);
        }}
        resultCount={filteredEnquiries.length}
        resultLabel="enquiry"
        onClearAll={() => {
          setSearchQuery("");
          setFilterStatus("");
        }}
      />

      <DateChips selected={selectedDateChip} onChange={setSelectedDateChip} />

      {filteredEnquiries.length === 0 ? (
        <p className="text-center text-default-500 py-10">
          No enquiries match your search.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEnquiries.map((enq) => (
            <EnquiryCard
              key={enq._id}
              enquiry={enq}
              onStatusUpdated={fetchEnquiries}
            />
          ))}
        </div>
      )}
    </div>
  );
}
