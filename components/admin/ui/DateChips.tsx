"use client";

/**
 * components/admin/ui/DateChips.tsx
 *
 * Horizontal scrollable row of date chips — today down to 7 days ago.
 * Clicking a chip selects that date (clicking again deselects it).
 */

import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";

interface DateChipsProps {
  /** Selected date in "YYYY-MM-DD" format, or "" for none */
  selected: string;
  onChange: (date: string) => void;
}

function buildChips(): { label: string; value: string }[] {
  const chips: { label: string; value: string }[] = [];
  const today = new Date();
  const count = 15; // number of days to show
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i); // past dates

    const day = d.getDate();
    const month = d.toLocaleString("en-IN", { month: "short" });
    const value = d.toISOString().slice(0, 10);

    let label: string;
    if (i === 1) label = `Yesterday, ${day} ${month}`;
    else label = `${day} ${month}`;

    chips.push({ label, value });
  }

  return chips;
}

export default function DateChips({ selected, onChange }: DateChipsProps) {
  const chips = buildChips();

  return (
    <ScrollShadow orientation="horizontal" className="w-full" hideScrollBar>
      <div className="flex gap-2 pb-1">
        {chips.map((chip) => {
          const isActive = selected === chip.value;
          return (
            <Chip
              key={chip.value}
              variant={isActive ? "solid" : "bordered"}
              color={isActive ? "primary" : "default"}
              className="cursor-pointer shrink-0 transition-all"
              onClick={() => onChange(isActive ? "" : chip.value)}
            >
              {chip.label}
            </Chip>
          );
        })}
      </div>
    </ScrollShadow>
  );
}
