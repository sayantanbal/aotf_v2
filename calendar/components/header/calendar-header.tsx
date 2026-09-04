import Link from "next/link";
import { Columns, List, Grid2x2, CalendarRange } from "lucide-react";
import { Button } from "@heroui/button";

import { UserSelect } from "@/calendar/components/header/user-select";
import { TodayButton } from "@/calendar/components/header/today-button";
import { DateNavigator } from "@/calendar/components/header/date-navigator";
import { AddEventDialog } from "@/calendar/components/dialogs/add-event-dialog";
import { RefreshButton } from "@/calendar/components/header/refresh-button";

import type { IEvent } from "@/calendar/interfaces";
import type { TCalendarView } from "@/calendar/types";
import { Accordion, AccordionItem } from "@heroui/accordion";

interface IProps {
  view: TCalendarView;
  events: IEvent[];
}

// ─── Legend item ─────────────────────────────────────────────────────────

function Dot({ color, label }: { color: string; label: string }) {
  const cls: Record<string, string> = {
    blue: "bg-blue-500",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
    green: "bg-green-500",
    red: "bg-red-500",
    purple: "bg-purple-500",
    gray: "bg-neutral-400",
  };
  return (
    <span className="flex items-center gap-1 text-[11px] text-default-500 whitespace-nowrap">
      <span
        className={`size-2 rounded-full shrink-0 ${cls[color] ?? "bg-blue-500"}`}
      />
      {label}
    </span>
  );
}

export function CalendarHeader({ view, events }: IProps) {
  return (
    <div className="flex flex-col gap-3 border-b p-4">
      {/* Top row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <TodayButton />
          <DateNavigator view={view} events={events} />
        </div>

        <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
          <div className="flex w-full items-center gap-1.5">
            <div className="inline-flex first:rounded-r-none last:rounded-l-none [&:not(:first-child):not(:last-child)]:rounded-none">
              <Button
                aria-label="View by day"
                isIconOnly
                variant={view === "day" ? "solid" : "flat"}
                className="rounded-r-none [&_svg]:size-5"
              >
                <Link href="/admin/day-view">
                  <List strokeWidth={1.8} />
                </Link>
              </Button>
              <Button
                aria-label="View by week"
                isIconOnly
                variant={view === "week" ? "solid" : "flat"}
                className="-ml-px rounded-none [&_svg]:size-5"
              >
                <Link href="/admin/week-view">
                  <Columns strokeWidth={1.8} />
                </Link>
              </Button>
              <Button
                aria-label="View by month"
                isIconOnly
                variant={view === "month" ? "solid" : "flat"}
                className="-ml-px rounded-none [&_svg]:size-5"
              >
                <Link href="/admin/month-view">
                  <Grid2x2 strokeWidth={1.8} />
                </Link>
              </Button>
              <Button
                aria-label="View by agenda"
                isIconOnly
                variant={view === "agenda" ? "solid" : "flat"}
                className="-ml-px rounded-l-none [&_svg]:size-5"
              >
                <Link href="/admin/agenda-view">
                  <CalendarRange strokeWidth={1.8} />
                </Link>
              </Button>
            </div>

            <UserSelect />
            <RefreshButton />
          </div>
        </div>
      </div>

      {/* ── Status legend ─────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <Accordion isCompact variant="bordered" className="w-full">
          <AccordionItem
            key="1"
            aria-label="Status Legend"
            title="Status Legend"
          >
            <div className="flex flex-col overflow-x-auto whitespace-nowrap py-1">
              <p className="text-[11px] font-semibold text-default-400 uppercase tracking-wide mb-0.5 shrink-0">
                Legend
              </p>

              {/* Tuition */}
              <Dot color="blue" label="📚 Applied" />
              <Dot color="yellow" label="📚 Demo Confirmation" />
              <Dot color="orange" label="📚 Guardian Confirmed" />
              <Dot color="green" label="📚 Completed" />

              <span className="w-px h-4 bg-default-200 shrink-0" />

              {/* Enquiry */}
              <Dot color="orange" label="📋 Pending" />
              <Dot color="green" label="📋 Resolved" />

              <span className="w-px h-4 bg-default-200 shrink-0" />

              {/* Job */}
              <Dot color="orange" label="💼 Job Pending" />
              <Dot color="blue" label="💼 Sent to Company" />

              <span className="w-px h-4 bg-default-200 shrink-0" />

              {/* Feedback */}
              <Dot color="red" label="💬 Needs Review" />
              <Dot color="yellow" label="💬 Under Review" />
              <Dot color="green" label="💬 Resolved" />

              <span className="w-px h-4 bg-default-200 shrink-0" />

              {/* Misc */}
              <Dot color="gray" label="Closed / Done" />
              <Dot color="red" label="Declined" />
            </div>
          </AccordionItem>
        </Accordion>
        <AddEventDialog>
          <Button isIconOnly className="sm:w-auto" color="primary" size="md">
            +
          </Button>
        </AddEventDialog>
      </div>
    </div>
  );
}
