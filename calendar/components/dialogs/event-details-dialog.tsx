"use client";

import { format, parseISO } from "date-fns";
import { Calendar, Clock, FileText, User, ExternalLink, Tag } from "lucide-react";
import { cloneElement, isValidElement, ReactElement } from "react";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

import { useDisclosure } from "@/hooks/use-disclosure";
import type { IEvent } from "@/calendar/interfaces";

// ─── Types ────────────────────────────────────────────────────────────────

type EventCategory = "tuition" | "enquiry" | "job" | "feedback" | "reminder" | "unknown";

interface ParsedEvent {
  category: EventCategory;
  statusLabel: string;
  color: "primary" | "warning" | "success" | "secondary" | "default" | "danger";
  fields: { key: string; value: string }[];
  navLink: string | null;
}

// ─── Parse description ────────────────────────────────────────────────────

function parseEvent(title: string, description: string): ParsedEvent {
  const lines = description.split("\n").filter(Boolean);

  // First line is the "[Category — Status]" header
  const headerLine = lines[0] ?? "";
  const headerMatch = headerLine.match(/\[([^\]]+)\]/);
  const headerContent = headerMatch?.[1] ?? "";

  // Detect category
  let category: EventCategory = "unknown";
  if (headerContent.toLowerCase().includes("tuition")) category = "tuition";
  else if (headerContent.toLowerCase().includes("enquiry")) category = "enquiry";
  else if (headerContent.toLowerCase().includes("job")) category = "job";
  else if (headerContent.toLowerCase().includes("feedback")) category = "feedback";
  else if (headerContent.toLowerCase().includes("reminder")) category = "reminder";

  // Status is after "—"
  const afterDash = headerContent.split("—")[1]?.trim() ?? headerContent;
  const statusLabel = afterDash || "—";

  // Color by category
  const colorMap: Record<EventCategory, ParsedEvent["color"]> = {
    tuition:  "primary",
    enquiry:  "warning",
    job:      "success",
    feedback: "secondary",
    reminder: "primary",
    unknown:  "default",
  };

  // Parse key:value pairs from remaining lines
  const fields: { key: string; value: string }[] = [];
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(": ");
    if (idx > -1) {
      fields.push({ key: line.slice(0, idx), value: line.slice(idx + 2) });
    } else if (line.trim()) {
      fields.push({ key: "", value: line.trim() });
    }
  }

  // Build nav link
  let navLink: string | null = null;
  const postIdField = fields.find((f) => f.key === "Post ID");
  const jobIdField = fields.find((f) => f.key === "Job ID");
  const refField = fields.find((f) => f.key === "Ref");

  if (postIdField?.value) navLink = `/admin/tuitions/${postIdField.value}`;
  else if (jobIdField?.value) navLink = `/admin/jobs/${jobIdField.value}`;
  else if (refField?.value) {
    const ref = refField.value;
    if (ref.startsWith("POST-")) navLink = `/admin/tuitions/${ref}`;
    else if (ref.startsWith("JB-")) navLink = `/admin/jobs/${ref}`;
  }

  return { category, statusLabel, color: colorMap[category], fields, navLink };
}

// ─── Status chip color ────────────────────────────────────────────────────

function statusChipColor(statusLabel: string): ParsedEvent["color"] {
  const s = statusLabel.toLowerCase();
  if (s.includes("complete") || s.includes("resolved") || s.includes("approved") || s.includes("company")) return "success";
  if (s.includes("guardian") || s.includes("sent")) return "warning";
  if (s.includes("demo") || s.includes("pending") || s.includes("applied")) return "primary";
  if (s.includes("declined") || s.includes("needs") || s.includes("open")) return "danger";
  if (s.includes("under") || s.includes("review")) return "warning";
  return "default";
}

// ─── Category label ───────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<EventCategory, string> = {
  tuition:  "📚 Tuition",
  enquiry:  "📋 Enquiry",
  job:      "💼 Job",
  feedback: "💬 Feedback",
  reminder: "⏰ Reminder",
  unknown:  "Event",
};

// ─── Component ────────────────────────────────────────────────────────────

interface IProps {
  event: IEvent;
  children: React.ReactNode;
}

export function EventDetailsDialog({ event, children }: IProps) {
  const { isOpen, onToggle } = useDisclosure();

  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const parsed = parseEvent(event.title, event.description);

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

  return (
    <>
      {trigger}

      <Modal isOpen={isOpen} onOpenChange={onToggle} placement="center" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              {/* Header */}
              <ModalHeader className="flex flex-col gap-2 pb-2">
                <span className="text-sm font-semibold leading-snug">{event.title}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip size="sm" color={parsed.color} variant="flat">
                    {CATEGORY_LABEL[parsed.category]}
                  </Chip>
                  <Chip size="sm" color={statusChipColor(parsed.statusLabel)} variant="dot">
                    {parsed.statusLabel}
                  </Chip>
                </div>
              </ModalHeader>

              <ModalBody className="space-y-3 pb-4">
                {/* Admin */}
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 size-4 shrink-0 text-default-400" />
                  <div>
                    <p className="text-xs text-default-400">Handled by</p>
                    <p className="text-sm font-medium">{event.user.name}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-default-400" />
                  <div>
                    <p className="text-xs text-default-400">Date</p>
                    <p className="text-sm">{format(startDate, "EEE, MMM d yyyy")}</p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-default-400" />
                  <div>
                    <p className="text-xs text-default-400">Time</p>
                    <p className="text-sm">
                      {format(startDate, "h:mm a")} — {format(endDate, "h:mm a")}
                    </p>
                  </div>
                </div>

                {/* Fields */}
                {parsed.fields.length > 0 && (
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-default-400" />
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-default-400">Details</p>
                      {parsed.fields.map((f, i) =>
                        f.key ? (
                          <div key={i} className="flex gap-1 text-sm flex-wrap">
                            <span className="font-medium text-default-600 shrink-0">{f.key}:</span>
                            <span className="text-default-800 wrap-break-word">{f.value}</span>
                          </div>
                        ) : (
                          <p key={i} className="text-sm text-default-600">{f.value}</p>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </ModalBody>

              <ModalFooter className="gap-2 pt-2">
                <Button variant="flat" size="sm" onPress={onClose}>
                  Close
                </Button>
                {parsed.navLink && (
                  <Button
                    as="a"
                    href={parsed.navLink}
                    color="primary"
                    size="sm"
                    endContent={<ExternalLink size={13} />}
                  >
                    View Record
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
