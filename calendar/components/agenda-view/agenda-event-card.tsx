"use client";

import { format, parseISO } from "date-fns";
import { cva } from "class-variance-authority";
import { Clock, Phone, Text, User } from "lucide-react";

import { useCalendar } from "@/calendar/contexts/calendar-context";

import { EventDetailsDialog } from "@/calendar/components/dialogs/event-details-dialog";

import type { IEvent } from "@/calendar/interfaces";
import type { VariantProps } from "class-variance-authority";

type ParsedDescription = {
  headline: string;
  phone: string | null;
  reference: string | null;
};

type ParsedTitle = {
  emoji: string | null;
  label: string;
  status: string | null;
};

function parseEventTitle(title: string): ParsedTitle {
  const parts = title
    .split("—")
    .map((part) => part.trim())
    .filter(Boolean);

  const rawLabel = parts[0] ?? title.trim();
  const status = parts[1] ?? null;
  const hasLeadingSymbol =
    rawLabel.length > 0 && !/[A-Za-z0-9]/.test(rawLabel.charAt(0));
  const emoji = hasLeadingSymbol ? rawLabel.slice(0, 2).trim() : null;
  const label = hasLeadingSymbol ? rawLabel.slice(2).trim() : rawLabel;

  return {
    emoji,
    label: label || rawLabel,
    status,
  };
}

function statusTone(status: string | null) {
  const value = status?.toLowerCase() ?? "";

  if (
    value.includes("complete") ||
    value.includes("approved") ||
    value.includes("resolved")
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900";
  }

  if (
    value.includes("pending") ||
    value.includes("review") ||
    value.includes("progress")
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900";
  }

  if (
    value.includes("rejected") ||
    value.includes("cancelled") ||
    value.includes("failed")
  ) {
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900";
  }

  return "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800";
}

function parseEventDescription(description: string): ParsedDescription {
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const headline = lines[0]?.replace(/^\[|\]$/g, "") ?? "Event details";
  let phone: string | null = null;
  let reference: string | null = null;

  for (const line of lines.slice(1)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex > -1) {
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key.toLowerCase() === "phone") {
        phone = value;
      }
      if (key.toLowerCase() === "post id" || key.toLowerCase() === "job id") {
        reference = value;
      }
    }
  }

  return { headline, phone, reference };
}

const agendaEventCardVariants = cva(
  "flex select-none items-center justify-between gap-3 rounded-md border p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      color: {
        // Colored variants
        blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 [&_.event-dot]:fill-blue-600",
        green:
          "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300 [&_.event-dot]:fill-green-600",
        red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300 [&_.event-dot]:fill-red-600",
        yellow:
          "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 [&_.event-dot]:fill-yellow-600",
        purple:
          "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 [&_.event-dot]:fill-purple-600",
        orange:
          "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300 [&_.event-dot]:fill-orange-600",
        gray: "border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 [&_.event-dot]:fill-neutral-600",

        // Dot variants
        "blue-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-blue-600",
        "green-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-green-600",
        "red-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-red-600",
        "orange-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-orange-600",
        "purple-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-purple-600",
        "yellow-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-yellow-600",
        "gray-dot":
          "bg-neutral-50 dark:bg-neutral-900 [&_.event-dot]:fill-neutral-600",
      },
    },
    defaultVariants: {
      color: "blue-dot",
    },
  },
);

interface IProps {
  event: IEvent;
  eventCurrentDay?: number;
  eventTotalDays?: number;
}

export function AgendaEventCard({
  event,
  eventCurrentDay,
  eventTotalDays,
}: IProps) {
  const { badgeVariant } = useCalendar();

  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);

  const color = (
    badgeVariant === "dot" ? `${event.color}-dot` : event.color
  ) as VariantProps<typeof agendaEventCardVariants>["color"];

  const agendaEventCardClasses = agendaEventCardVariants({ color });
  const parsedTitle = parseEventTitle(event.title);
  const parsedDescription = parseEventDescription(event.description);
  const sanitizedPhone = parsedDescription.phone
    ? parsedDescription.phone.replace(/\s+/g, "").replace(/[^+\d]/g, "")
    : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click();
    }
  };

  return (
    <EventDetailsDialog event={event}>
      <div
        role="button"
        tabIndex={0}
        className={agendaEventCardClasses}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {["mixed", "dot"].includes(badgeVariant) && (
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                className="event-dot shrink-0"
              >
                <circle cx="4" cy="4" r="4" />
              </svg>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {parsedTitle.emoji && (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs dark:bg-white/10">
                    {parsedTitle.emoji}
                  </span>
                )}

                <span className="min-w-0 truncate font-medium">
                  {eventCurrentDay && eventTotalDays && (
                    <span className="mr-1 text-xs">
                      Day {eventCurrentDay} of {eventTotalDays} • {""}
                    </span>
                  )}
                  {parsedTitle.label}
                </span>

                {parsedTitle.status && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(
                      parsedTitle.status,
                    )}`}
                  >
                    {parsedTitle.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1">
            <User className="size-3 shrink-0" />
            <p className="text-xs text-foreground">{event.user.name}</p>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <p className="text-xs text-foreground">
              {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Text className="size-3 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/70 dark:bg-white/10">
                  {parsedDescription.headline}
                </span>
                {parsedDescription.phone && (
                  <a
                    href={sanitizedPhone ? `tel:${sanitizedPhone}` : undefined}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={`Call ${parsedDescription.phone}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-black/5 bg-white px-2.5 py-0.5 text-[11px] text-foreground/80 shadow-sm dark:border-white/10 dark:bg-white/5"
                  >
                    <Phone className="size-3 shrink-0" />
                    <span className="truncate">{parsedDescription.phone}</span>
                  </a>
                )}
                {parsedDescription.reference && (
                  <span className="inline-flex max-w-full items-center rounded-full border border-black/5 bg-white px-2.5 py-0.5 text-[11px] text-foreground/80 shadow-sm dark:border-white/10 dark:bg-white/5">
                    {parsedDescription.reference}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </EventDetailsDialog>
  );
}
