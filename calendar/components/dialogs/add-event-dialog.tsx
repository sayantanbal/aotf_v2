"use client";
import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useCalendar } from "@/calendar/contexts/calendar-context";

import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

import { Avatar } from "@heroui/avatar";

// ─── Status options per category ─────────────────────────────────────────

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  tuition: [
    { value: "demo_reminder", label: "Demo Reminder" },
    { value: "demo_confirmation", label: "Demo Confirmation" },
    { value: "guardian_confirmed", label: "Guardian Confirmed" },
    { value: "completed", label: "Completed" },
  ],
  enquiry: [
    { value: "pending", label: "Pending" },
    { value: "resolved", label: "Resolved" },
  ],
  job: [
    { value: "pending", label: "Pending" },
    { value: "sent_to_company", label: "Sent to Company" },
  ],
  feedback: [
    { value: "open", label: "Open" },
    { value: "under_review", label: "Under Review" },
    { value: "action_taken", label: "Action Taken" },
    { value: "resolved", label: "Resolved" },
  ],
};

function toLocalDatetimeInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface IProps {
  children: React.ReactNode;
  startDate?: Date;
  startTime?: { hour: number; minute: number };
}

export function AddEventDialog({ children, startDate, startTime }: IProps) {
  const { users, refreshEvents } = useCalendar();
  const { isOpen, onClose, onToggle } = useDisclosure();

  const [saving, setSaving] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────
  const initialDueAt = (() => {
    if (startDate) {
      const d = new Date(startDate);
      if (startTime) d.setHours(startTime.hour, startTime.minute);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    }
    return toLocalDatetimeInput();
  })();

  const [form, setForm] = useState({
    category: "tuition" as string,
    status: "demo_reminder" as string,
    title: "",
    note: "",
    dueAt: initialDueAt,
    userId: "",        // selected admin id (optional)
    handledByAdminName: "",
    refLabel: "",
  });

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        onClick: (e: any) => {
          (children as ReactElement<any>).props?.onClick?.(e);
          onToggle();
        },
        ...(typeof children.type !== "string"
          ? {
              onPress: (e: any) => {
                (children as ReactElement<any>).props?.onPress?.(e);
                onToggle();
              },
            }
          : {}),
      })
    : children;

  const handleCategoryChange = (cat: string) => {
    setForm((p) => ({
      ...p,
      category: cat,
      status: STATUS_OPTIONS[cat]?.[0]?.value ?? "",
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      addToast({ description: "Title is required", color: "danger" });
      return;
    }
    setSaving(true);
    try {
      const selectedUser = users.find((u) => u.id === form.userId);
      const payload = {
        category: form.category,
        status: form.status,
        title: form.title.trim(),
        note: form.note.trim() || undefined,
        dueAt: new Date(form.dueAt).toISOString(),
        refLabel: form.refLabel.trim() || undefined,
        handledByAdminId: selectedUser?.id !== "system" ? selectedUser?.id : undefined,
        handledByAdminName: (selectedUser?.name ?? form.handledByAdminName.trim()) || undefined,
      };

      const res = await fetch("/api/admin/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create reminder");

      addToast({ description: "Reminder added to calendar ✅", color: "success" });
      onClose();

      // Reset form
      setForm({
        category: "tuition",
        status: "demo_reminder",
        title: "",
        note: "",
        dueAt: toLocalDatetimeInput(),
        userId: "",
        handledByAdminName: "",
        refLabel: "",
      });

      // Refresh calendar events so the new reminder appears
      await refreshEvents();
    } catch (err) {
      addToast({
        description: err instanceof Error ? err.message : "Failed to save",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {trigger}

      <Modal isOpen={isOpen} onOpenChange={onToggle} placement="top" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Add Calendar Reminder</ModalHeader>

              <ModalBody className="space-y-3">
                {/* Category */}
                <Select
                  label="Category"
                  selectedKeys={[form.category]}
                  onSelectionChange={(keys) => handleCategoryChange(Array.from(keys)[0] as string)}
                  variant="bordered"
                  size="sm"
                >
                  <SelectItem key="tuition">📚 Tuition</SelectItem>
                  <SelectItem key="enquiry">📋 Enquiry</SelectItem>
                  <SelectItem key="job">💼 Job</SelectItem>
                  <SelectItem key="feedback">💬 Feedback</SelectItem>
                </Select>

                {/* Status */}
                <Select
                  label="Status / Type"
                  selectedKeys={[form.status]}
                  onSelectionChange={(keys) =>
                    setForm((p) => ({ ...p, status: Array.from(keys)[0] as string }))
                  }
                  variant="bordered"
                  size="sm"
                >
                  {(STATUS_OPTIONS[form.category] ?? []).map((opt) => (
                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>

                {/* Title */}
                <Input
                  label="Title"
                  placeholder="e.g. Call guardian for demo confirmation"
                  value={form.title}
                  onValueChange={(v) => setForm((p) => ({ ...p, title: v }))}
                  variant="bordered"
                  size="sm"
                  isRequired
                />

                {/* Due date + time */}
                <div>
                  <label className="text-xs text-default-500 mb-1 block font-medium">
                    Due Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
                    className="w-full rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Assigned Admin */}
                <Select
                  label="Assigned to Admin"
                  selectedKeys={form.userId ? [form.userId] : []}
                  onSelectionChange={(keys) =>
                    setForm((p) => ({ ...p, userId: Array.from(keys)[0] as string ?? "" }))
                  }
                  variant="bordered"
                  size="sm"
                >
                  {users.map((u) => (
                    <SelectItem key={u.id} textValue={u.name ?? "User"}>
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={u.picturePath ?? undefined}
                          name={u.name ?? "User"}
                          className="size-5"
                        />
                        {u.name}
                      </div>
                    </SelectItem>
                  ))}
                </Select>

                {/* Ref label */}
                <Input
                  label="Reference (optional)"
                  placeholder="e.g. POST-010525-001 or ENQ-001"
                  value={form.refLabel}
                  onValueChange={(v) => setForm((p) => ({ ...p, refLabel: v }))}
                  variant="bordered"
                  size="sm"
                />

                {/* Note */}
                <Textarea
                  label="Note (optional)"
                  placeholder="Add any relevant details…"
                  value={form.note}
                  onValueChange={(v) => setForm((p) => ({ ...p, note: v }))}
                  variant="bordered"
                  size="sm"
                  minRows={2}
                />
              </ModalBody>

              <ModalFooter>
                <Button variant="flat" onPress={onClose} isDisabled={saving}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleSave} isLoading={saving}>
                  Add to Calendar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
