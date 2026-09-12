"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { enGB } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseYyyyMmDd(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function formatYyyyMmDd(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calendar overflow for dates past the five Link chips.
 * Client only because Popover/Calendar cannot be RSC; router.push is a
 * client transition (same as Link — Next use-router.md).
 * Past days are disabled. A past ?date= does not select this chip.
 */
export function PublicDateCalendarChip({
  tenantSlug,
  selectedDate,
  todayYmd,
  isSelected,
  className,
  otherDateLabel,
}: {
  tenantSlug: string;
  selectedDate: string;
  todayYmd: string;
  isSelected: boolean;
  className?: string;
  otherDateLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const todayDate = parseYyyyMmDd(todayYmd);
  const parsedSelected = parseYyyyMmDd(selectedDate);
  const selectedIsPast =
    parsedSelected !== undefined &&
    todayDate !== undefined &&
    formatYyyyMmDd(parsedSelected) < todayYmd;
  const selected = selectedIsPast ? undefined : parsedSelected;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={otherDateLabel}
          aria-pressed={isSelected}
          className={className}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected ?? todayDate}
          disabled={todayDate ? { before: todayDate } : undefined}
          onSelect={(date) => {
            setOpen(false);
            const next = formatYyyyMmDd(date);
            if (todayYmd && next < todayYmd) return;
            if (next === selectedDate) return;
            const query = new URLSearchParams();
            query.set("tenant", tenantSlug);
            query.set("date", next);
            router.push(`/?${query.toString()}`, { scroll: false });
          }}
          locale={enGB}
          numerals="latn"
        />
      </PopoverContent>
    </Popover>
  );
}
