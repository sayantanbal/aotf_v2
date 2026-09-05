"use client";

import { reportClientError } from "@/lib/client-report-error";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Spinner } from "@heroui/spinner";
import { Calendar, Mail, MessageSquare, Star, User } from "lucide-react";
import AdminSearchBar, {
  type FilterConfig,
} from "@/components/admin/ui/AdminSearchBar";

type Category = "bug" | "suggestion" | "complaint" | "payment" | "general";
type Status = "open" | "seen" | "resolved";

type FeedbackData = {
  _id: string;
  userId: string;
  userType: "teacher" | "teacher_candidate";
  userSnapshot: {
    name: string;
    username: string;
    role: "teacher" | "teacher_candidate";
    email: string;
  };
  category: Category;
  subject: string;
  message: string;
  rating: number | null;
  status: Status;
  handledByAdminId: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
  adminNotes: string | null;
};

const feedbackFilterConfigs: FilterConfig[] = [
  {
    key: "status",
    label: "Status",
    placeholder: "All statuses",
    options: [
      { key: "open", label: "Open" },
      { key: "seen", label: "Seen" },
      { key: "resolved", label: "Resolved" },
    ],
  },
  {
    key: "category",
    label: "Category",
    placeholder: "All categories",
    options: [
      { key: "bug", label: "Bug" },
      { key: "suggestion", label: "Suggestion" },
      { key: "complaint", label: "Complaint" },
      { key: "payment", label: "Payment" },
      { key: "general", label: "General" },
    ],
  },
];

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackData | null>(
    null,
  );
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState<Status>("open");
  const [updating, setUpdating] = useState(false);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/feedback?limit=100", {
        cache: "no-store",
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");

      if (!isJson) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error(
          `Server returned non-JSON response (${res.status}). Content-Type: ${contentType}`,
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to fetch feedbacks (${res.status})`,
        );
      }

      if (!data || !Array.isArray(data.feedbacks)) {
        console.error("Invalid data structure:", data);
        throw new Error("Invalid response structure from server");
      }

      setFeedbacks(data.feedbacks);
    } catch (err) {
      reportClientError(err, { feature: "admin-feedbacks" });
      console.error("Fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch feedbacks",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (filterStatus && fb.status !== filterStatus) return false;
      if (filterCategory && fb.category !== filterCategory) return false;

      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        fb.userSnapshot.name.toLowerCase().includes(query) ||
        fb.userSnapshot.username.toLowerCase().includes(query) ||
        fb.userSnapshot.email.toLowerCase().includes(query) ||
        fb.subject.toLowerCase().includes(query) ||
        fb.message.toLowerCase().includes(query)
      );
    });
  }, [feedbacks, filterCategory, filterStatus, searchQuery]);

  const handleViewFeedback = (feedback: FeedbackData) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.adminNotes || "");
    setNewStatus(feedback.status);
    onOpen();
  };

  const handleClose = () => {
    setSelectedFeedback(null);
    setAdminNotes("");
    setNewStatus("open");
    onClose();
  };

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;

    setUpdating(true);

    try {
      const res = await fetch(`/api/v1/feedback/${selectedFeedback._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          adminNotes: adminNotes.trim() || undefined,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await res.json() : null;

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to update feedback (${res.status})`,
        );
      }

      addToast({
        description: "Feedback updated successfully",
        color: "success",
      });
      await fetchFeedbacks();
      handleClose();
    } catch (err) {
      reportClientError(err, { feature: "admin-feedbacks" });
      addToast({
        description:
          err instanceof Error ? err.message : "Failed to update feedback",
        color: "danger",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getCategoryColor = (
    category: Category,
  ): "primary" | "success" | "warning" | "danger" | "default" => {
    const colors: Record<
      Category,
      "primary" | "success" | "warning" | "danger" | "default"
    > = {
      bug: "danger",
      suggestion: "primary",
      complaint: "warning",
      payment: "warning",
      general: "default",
    };
    return colors[category];
  };

  const getStatusColor = (
    status: Status,
  ): "success" | "warning" | "default" => {
    const colors: Record<Status, "success" | "warning" | "default"> = {
      open: "warning",
      seen: "default",
      resolved: "success",
    };
    return colors[status];
  };

  const renderStars = (rating: number | null) => {
    if (!rating) {
      return <span className="text-xs text-default-400">No rating</span>;
    }

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 w-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-danger w-full">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 w-full">
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Feedback Management</h1>
          <p className="text-sm text-default-500 mt-1">
            Manage and respond to user feedback
          </p>
        </div>
      </div>

      <AdminSearchBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by user, email, subject or message…"
        filters={feedbackFilterConfigs}
        filterValues={{ status: filterStatus, category: filterCategory }}
        onFilterChange={(key, value) => {
          if (key === "status") setFilterStatus(value);
          if (key === "category") setFilterCategory(value);
        }}
        resultCount={filteredFeedbacks.length}
        resultLabel="feedback"
        onClearAll={() => {
          setSearchQuery("");
          setFilterStatus("");
          setFilterCategory("");
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFeedbacks.map((feedback) => (
          <Card key={feedback._id} className="w-full">
            <CardHeader className="flex flex-col gap-3 items-start">
              <div className="flex justify-between w-full items-start">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="text-primary" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {feedback.userSnapshot.name}
                    </p>
                    <p className="text-xs text-default-500">
                      @{feedback.userSnapshot.username}
                    </p>
                  </div>
                </div>
                <Chip
                  size="sm"
                  color={getCategoryColor(feedback.category)}
                  variant="flat"
                >
                  {feedback.category}
                </Chip>
              </div>
              <div className="w-full">
                <p className="text-md font-semibold">{feedback.subject}</p>
                {renderStars(feedback.rating)}
              </div>
            </CardHeader>
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-default-500">
                <Mail size={14} />
                {feedback.userSnapshot.email}
              </div>
              <p className="text-sm text-default-600 line-clamp-3">
                {feedback.message}
              </p>
              <div className="flex items-center gap-2 text-xs text-default-500">
                <Calendar size={14} />
                {new Date(feedback.createdAt).toLocaleDateString()}
              </div>
            </CardBody>
            <CardFooter className="gap-2">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                className="flex-1"
                onPress={() => handleViewFeedback(feedback)}
              >
                View Details
              </Button>
              <Chip
                size="sm"
                color={getStatusColor(feedback.status)}
                variant="flat"
              >
                {feedback.status}
              </Chip>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredFeedbacks.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare size={48} className="mx-auto text-default-300 mb-4" />
          <p className="text-default-500">
            No feedbacks match the current filters.
          </p>
        </div>
      )}

      {/* Feedback Detail Modal */}
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Feedback Details
          </ModalHeader>
          <ModalBody>
            {selectedFeedback && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-default-400" />
                      <span className="font-semibold">
                        {selectedFeedback.userSnapshot.name}
                      </span>
                    </div>
                    <p className="text-sm text-default-500 ml-6">
                      @{selectedFeedback.userSnapshot.username} ·{" "}
                      {selectedFeedback.userSnapshot.role.replace("_", " ")}
                    </p>
                    <p className="text-sm text-default-500 ml-6">
                      {selectedFeedback.userSnapshot.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Chip
                      color={getCategoryColor(selectedFeedback.category)}
                      variant="flat"
                    >
                      {selectedFeedback.category}
                    </Chip>
                    <Chip
                      color={getStatusColor(selectedFeedback.status)}
                      variant="flat"
                    >
                      {selectedFeedback.status}
                    </Chip>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-lg">
                    {selectedFeedback.subject}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-default-500">Rating:</span>
                    {renderStars(selectedFeedback.rating)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-default-500">
                    <Calendar size={14} />
                    Submitted on{" "}
                    {new Date(selectedFeedback.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-sm">User Message:</p>
                  <Card className="bg-default-100">
                    <CardBody>
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedFeedback.message}
                      </p>
                    </CardBody>
                  </Card>
                </div>

                {selectedFeedback.handledAt && (
                  <div className="text-sm text-default-500">
                    Last handled on{" "}
                    {new Date(selectedFeedback.handledAt).toLocaleString()}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-semibold text-sm">
                    Update Status:
                  </label>
                  <Select
                    selectedKeys={[newStatus]}
                    onChange={(e: any) =>
                      setNewStatus(e.target.value as Status)
                    }
                    variant="bordered"
                  >
                    <SelectItem key="open">Open</SelectItem>
                    <SelectItem key="seen">Seen</SelectItem>
                    <SelectItem key="resolved">Resolved</SelectItem>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-sm">Admin Notes:</label>
                  <Textarea
                    placeholder="Add internal notes or response details..."
                    value={adminNotes}
                    onChange={(e: any) => setAdminNotes(e.target.value)}
                    variant="bordered"
                    minRows={4}
                  />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleClose} isDisabled={updating}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleUpdateFeedback}
              isLoading={updating}
            >
              Update Feedback
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
