"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { Star, Plus, EyeOff, Eye, Trash2, Pencil } from "lucide-react";

type AdminReview = {
  id: string;
  rating: number;
  title: string | null;
  message: string;
  status: "active" | "hidden";
  createdAt: string;
  updatedAt: string;
  user: {
    username: string;
    name: string;
    imageUrl: string | null;
  };
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i + 1 <= rating;
        return (
          <Star
            key={i}
            size={14}
            className={
              filled ? "text-amber-500 fill-amber-500" : "text-default-300"
            }
          />
        );
      })}
    </div>
  );
}

export default function AdminReviewsPage() {
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "hidden">(
    ""
  );
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<AdminReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget] = useState<AdminReview | null>(null);

  const [form, setForm] = useState({
    username: "",
    rating: 5,
    title: "",
    message: "",
    status: "active" as "active" | "hidden",
  });

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", "1");
      params.set("limit", "50");

      const res = await fetch(`/api/v1/reviews?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          (d as any).error || `Failed to fetch reviews (${res.status})`
        );
      }
      const data = (await res.json()) as { reviews: AdminReview[] };
      setItems(data.reviews ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch reviews");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const openCreate = () => {
    setMode("create");
    setEditTarget(null);
    setForm({
      username: "",
      rating: 5,
      title: "",
      message: "",
      status: "active",
    });
    onOpen();
  };

  const openEdit = (r: AdminReview) => {
    setMode("edit");
    setEditTarget(r);
    setForm({
      username: r.user.username,
      rating: r.rating,
      title: r.title ?? "",
      message: r.message,
      status: r.status,
    });
    onOpen();
  };

  const submit = async () => {
    try {
      if (!form.username.trim()) throw new Error("Username is required");
      if (!form.message.trim()) throw new Error("Message is required");

      if (mode === "create") {
        const res = await fetch("/api/v1/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username.trim(),
            rating: Number(form.rating),
            title: form.title.trim() ? form.title.trim() : null,
            message: form.message.trim(),
            status: form.status,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as any).error || "Failed to create review");
        }
        addToast({ description: "Review created", color: "success" });
      } else {
        if (!editTarget) return;
        const res = await fetch(`/api/v1/reviews/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating: Number(form.rating),
            title: form.title.trim() ? form.title.trim() : null,
            message: form.message.trim(),
            status: form.status,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as any).error || "Failed to update review");
        }
        addToast({ description: "Review updated", color: "success" });
      }

      onClose();
      fetchReviews();
    } catch (e) {
      addToast({
        description: e instanceof Error ? e.message : "Failed to save review",
        color: "danger",
      });
    }
  };

  const deleteReview = async (r: AdminReview) => {
    if (!confirm(`Delete review by @${r.user.username}?`)) return;

    try {
      const res = await fetch(`/api/v1/reviews/${r.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || "Failed to delete review");
      }
      addToast({ description: "Review deleted", color: "success" });
      fetchReviews();
    } catch (e) {
      addToast({
        description: e instanceof Error ? e.message : "Failed to delete review",
        color: "danger",
      });
    }
  };

  const filtered = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  return (
    <div className="space-y-4 px-4 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-default-900">Reviews</h1>
        <Button
          color="primary"
          variant="solid"
          startContent={<Plus size={16} />}
          onPress={openCreate}
        >
          Add Review
        </Button>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Status"
              selectedKeys={statusFilter ? [statusFilter] : []}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0] as any;
                setStatusFilter(v || "");
              }}
              className="max-w-xs"
            >
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="hidden">Hidden</SelectItem>
            </Select>
            {statusFilter && (
              <Button variant="flat" onPress={() => setStatusFilter("")}>
                Clear filter
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : error ? (
            <div className="py-6 text-danger">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-default-500">No reviews found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((r) => (
                <Card key={r.id} className="border border-default-200">
                  <CardHeader className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          r.user.imageUrl ??
                          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200"
                        }
                        className="w-10 h-10 rounded-full object-cover"
                        alt={r.user.name}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.user.name}</p>
                        <p className="text-xs text-default-500 truncate">
                          @{r.user.username}
                        </p>
                        <div className="mt-1">
                          <Stars rating={r.rating} />
                        </div>
                      </div>
                    </div>
                    <Chip
                      size="sm"
                      color={r.status === "active" ? "success" : "default"}
                      variant="flat"
                      startContent={
                        r.status === "active" ? (
                          <Eye size={14} />
                        ) : (
                          <EyeOff size={14} />
                        )
                      }
                      className="capitalize"
                    >
                      {r.status}
                    </Chip>
                  </CardHeader>
                  <CardBody className="pt-0">
                    {r.title ? <p className="font-medium">{r.title}</p> : null}
                    <p className="text-sm text-default-700 mt-1">{r.message}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Pencil size={16} />}
                        onPress={() => openEdit(r)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        startContent={<Trash2 size={16} />}
                        onPress={() => deleteReview(r)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                {mode === "create" ? "Add Review" : "Edit Review"}
              </ModalHeader>
              <ModalBody className="gap-3">
                <Input
                  label="Username (must exist)"
                  value={form.username}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, username: v }))
                  }
                  isDisabled={mode === "edit"}
                  description={
                    mode === "edit"
                      ? "Username cannot be changed while editing"
                      : undefined
                  }
                />

                <Select
                  label="Rating"
                  selectedKeys={[String(form.rating)]}
                  onSelectionChange={(keys) => {
                    const v = Number(Array.from(keys)[0] ?? 5);
                    setForm((p) => ({ ...p, rating: v }));
                  }}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <SelectItem key={String(n)}>{String(n)}</SelectItem>
                  ))}
                </Select>

                <Input
                  label="Title (optional)"
                  value={form.title}
                  onValueChange={(v) => setForm((p) => ({ ...p, title: v }))}
                />

                <Textarea
                  label="Message"
                  value={form.message}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, message: v }))
                  }
                  minRows={4}
                />

                <Select
                  label="Visibility"
                  selectedKeys={[form.status]}
                  onSelectionChange={(keys) => {
                    const v =
                      (Array.from(keys)[0] as "active" | "hidden") ??
                      "active";
                    setForm((p) => ({ ...p, status: v }));
                  }}
                >
                  <SelectItem key="active">Active (shown on homepage)</SelectItem>
                  <SelectItem key="hidden">Hidden</SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={submit}>
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
