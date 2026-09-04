"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
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
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Users,
  ExternalLink,
  CheckCircle2,
  Link,
} from "lucide-react";
import { reportClientError } from "@/lib/client-report-error";

type GroupStatus = "active" | "inactive" | "full" | "archived" | "custom";

type WhatsAppGroup = {
  _id: string;
  label: string;
  url: string;
  status: GroupStatus;
  capacity: number;
  memberCount: number;
  ordering: number;
  creatorClerkId: string | null;
  updaterClerkId: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  label: string;
  url: string;
  status: GroupStatus;
  capacity: number;
  ordering: number;
  memberCount: number;
};

const STATUS_OPTIONS: Array<{ key: GroupStatus; label: string }> = [
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "full", label: "Full" },
  { key: "archived", label: "Archived" },
  { key: "custom", label: "Custom" },
];

const STATUS_COLORS: Record<GroupStatus, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  inactive: "warning",
  full: "warning",
  archived: "default",
  custom: "default",
};

const DEFAULT_FORM: FormState = {
  label: "",
  url: "",
  status: "active",
  capacity: 1024,
  ordering: 0,
  memberCount: 0,
};

export default function WhatsAppGroupsPage() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<WhatsAppGroup | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const createModal = useDisclosure();
  const editModal = useDisclosure();

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp-groups");
      if (!res.ok) throw new Error("Failed to load groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      reportClientError(err, { feature: "admin-whatsapp-groups" });
      addToast({ description: "Failed to load WhatsApp groups", color: "danger" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async () => {
    if (!form.label.trim() || !form.url.trim()) {
      addToast({ description: "Label and URL are required", color: "warning" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/whatsapp-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      addToast({ description: "WhatsApp group created successfully", color: "success" });
      createModal.onClose();
      setForm(DEFAULT_FORM);
      void fetchGroups();
    } catch (err) {
      reportClientError(err, { feature: "admin-whatsapp-groups" });
      addToast({ description: err instanceof Error ? err.message : "Failed to create group", color: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingGroup) return;
    if (!form.label.trim() || !form.url.trim()) {
      addToast({ description: "Label and URL are required", color: "warning" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/whatsapp-groups/${editingGroup._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update group");
      addToast({ description: "WhatsApp group updated successfully", color: "success" });
      editModal.onClose();
      setEditingGroup(null);
      setForm(DEFAULT_FORM);
      void fetchGroups();
    } catch (err) {
      reportClientError(err, { feature: "admin-whatsapp-groups" });
      addToast({ description: err instanceof Error ? err.message : "Failed to update group", color: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (group: WhatsAppGroup) => {
    if (!window.confirm(`Delete "${group.label}"? This cannot be undone.`)) return;
    setDeletingId(group._id);
    try {
      const res = await fetch(`/api/admin/whatsapp-groups/${group._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete group");
      }
      addToast({ description: "WhatsApp group deleted", color: "success" });
      void fetchGroups();
    } catch (err) {
      reportClientError(err, { feature: "admin-whatsapp-groups" });
      addToast({ description: err instanceof Error ? err.message : "Failed to delete group", color: "danger" });
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (group: WhatsAppGroup) => {
    setEditingGroup(group);
    setForm({
      label: group.label,
      url: group.url,
      status: group.status,
      capacity: group.capacity,
      ordering: group.ordering,
      memberCount: group.memberCount,
    });
    editModal.onOpen();
  };

  const openCreateModal = () => {
    setForm(DEFAULT_FORM);
    createModal.onOpen();
  };

  const activeCount = groups.filter((g) => g.status === "active").length;
  const fullCount = groups.filter((g) => g.status === "full").length;

  return (
    <div className="w-full space-y-4 px-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="text-success" size={26} />
            WhatsApp Group Links
          </h1>
          <p className="text-sm text-default-500 mt-1">
            Manage onboarding WhatsApp group links shown to new providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            isIconOnly
            size="md"
            variant="flat"
            color="primary"
            onPress={() => void fetchGroups()}
            isLoading={isLoading}
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            color="success"
            startContent={<Plus size={16} />}
            onPress={openCreateModal}
          >
            Add Group
          </Button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip variant="flat" color="default">{groups.length} total</Chip>
        <Chip variant="flat" color="success">{activeCount} active</Chip>
        {fullCount > 0 && <Chip variant="flat" color="warning">{fullCount} full</Chip>}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={48} className="mx-auto text-default-300 mb-4" />
          <p className="text-default-500">No WhatsApp groups yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((group) => (
            <Card key={group._id} className="border border-default-200">
              <CardHeader className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare size={18} className="text-success shrink-0" />
                  <span className="font-semibold truncate">{group.label}</span>
                </div>
                <Chip
                  size="sm"
                  variant="flat"
                  color={STATUS_COLORS[group.status]}
                  className="shrink-0 capitalize"
                >
                  {group.status}
                </Chip>
              </CardHeader>
              <CardBody className="space-y-2 pt-0">
                <a
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                >
                  <Link size={12} />
                  <span className="truncate">{group.url}</span>
                  <ExternalLink size={11} className="shrink-0" />
                </a>
                <div className="flex items-center gap-3 text-xs text-default-500">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {group.memberCount}/{group.capacity}
                  </span>
                  <span>Order: {group.ordering}</span>
                </div>
                {group.status === "active" && (
                  <div className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 size={12} />
                    Visible during onboarding
                  </div>
                )}
              </CardBody>
              <CardFooter className="gap-2 pt-0">
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={<Pencil size={14} />}
                  className="flex-1"
                  onPress={() => openEditModal(group)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  startContent={<Trash2 size={14} />}
                  isLoading={deletingId === group._id}
                  onPress={() => void handleDelete(group)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onOpenChange={createModal.onOpenChange} size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Add WhatsApp Group</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Label"
                  placeholder="e.g. Teachers Group A"
                  value={form.label}
                  onValueChange={(v) => setForm((p) => ({ ...p, label: v }))}
                  isRequired
                />
                <Input
                  label="Invite URL"
                  placeholder="https://chat.whatsapp.com/..."
                  value={form.url}
                  onValueChange={(v) => setForm((p) => ({ ...p, url: v }))}
                  isRequired
                />
                <Select
                  label="Status"
                  selectedKeys={[form.status]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as GroupStatus;
                    if (val) setForm((p) => ({ ...p, status: val }));
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Capacity"
                    type="number"
                    value={String(form.capacity)}
                    onValueChange={(v) => setForm((p) => ({ ...p, capacity: Number(v) || 1024 }))}
                  />
                  <Input
                    label="Order (lower = first)"
                    type="number"
                    value={String(form.ordering)}
                    onValueChange={(v) => setForm((p) => ({ ...p, ordering: Number(v) || 0 }))}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="success" isLoading={isSubmitting} onPress={() => void handleCreate()}>
                  Create
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Edit WhatsApp Group</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Label"
                  value={form.label}
                  onValueChange={(v) => setForm((p) => ({ ...p, label: v }))}
                  isRequired
                />
                <Input
                  label="Invite URL"
                  value={form.url}
                  onValueChange={(v) => setForm((p) => ({ ...p, url: v }))}
                  isRequired
                />
                <Select
                  label="Status"
                  selectedKeys={[form.status]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as GroupStatus;
                    if (val) setForm((p) => ({ ...p, status: val }));
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Members"
                    type="number"
                    value={String(form.memberCount)}
                    onValueChange={(v) => setForm((p) => ({ ...p, memberCount: Number(v) || 0 }))}
                  />
                  <Input
                    label="Capacity"
                    type="number"
                    value={String(form.capacity)}
                    onValueChange={(v) => setForm((p) => ({ ...p, capacity: Number(v) || 1024 }))}
                  />
                  <Input
                    label="Order"
                    type="number"
                    value={String(form.ordering)}
                    onValueChange={(v) => setForm((p) => ({ ...p, ordering: Number(v) || 0 }))}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" isLoading={isSubmitting} onPress={() => void handleEdit()}>
                  Save Changes
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
