"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon } from "lucide-react";
import { ar, enGB } from "react-day-picker/locale";
import { cn } from "cn";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDisplayDate } from "@/lib/format-display-date";
import type { UiLocale } from "@/lib/locale";
import type { DayTab } from "@/modules/booking/domain/day-tabs";
import { useDayNav } from "./day-nav";

/**
 * Horizontally scrollable day tabs. Past sits on the right in Arabic, future on the left
 * (flex follows the document direction). The selected tab is centred on load.
 */
export function DayTabs({
  tabs,
  todayDate,
  todayNumber,
  maxDate,
  calendarLabel,
  locale,
}: {
  tabs: DayTab[];
  todayDate: string;
  todayNumber: number;
  maxDate: string;
  calendarLabel: string;
  locale: UiLocale;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { selected, go } = useDayNav();
  const selectedIndex = tabs.findIndex((tab) => tab.date === selected);

  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const shift = tabBox.left + tabBox.width / 2 - (listBox.left + listBox.width / 2);
    list.scrollBy({ left: shift, behavior: "auto" });
  }, [selected]);

  function pickDate(date: Date) {
    const value = ymd(date);
    setPickerOpen(false);
    if (value > maxDate || value === selected) return;
    go(value, value === todayDate ? "/owner/today" : `/owner/today?date=${value}`);
  }

  return (
    <div className="flex items-center gap-2">
      <div
        ref={listRef}
        role="tablist"
        className={cn(
          "no-scrollbar flex min-w-0 flex-1 overflow-x-auto",
          // 24px fade at both ends: cut-off tabs read as "more days", not clipped text.
          "[-webkit-mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]",
          "[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]",
        )}
      >
        {tabs.map((tab, index) => {
          const active = tab.date === selected;
          const href = tab.kind === "today" ? "/owner/today" : `/owner/today?date=${tab.date}`;
          return (
            <Link
              key={tab.date}
              role="tab"
              aria-selected={active}
              aria-current={tab.kind === "today" ? "date" : undefined}
              scroll={false}
              // Only the days next to the selected one are prefetched; the rest wait for hover.
              prefetch={Math.abs(index - selectedIndex) === 1 ? null : false}
              href={href}
              onClick={(event) => {
                if (event.defaultPrevented || event.button !== 0) return;
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                go(tab.date, href);
              }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center justify-center px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative inline-flex">
                {/* The after: copy is bold and invisible, so selecting a tab never changes its width. */}
                <span
                  data-label={tab.label}
                  className="whitespace-nowrap after:invisible after:block after:h-0 after:overflow-hidden after:font-bold after:content-[attr(data-label)]"
                >
                  {tab.label}
                </span>
                {/* Active marker: full label width, 6px under it, out of flow so the label stays centred
                    in the tab. Always rendered so tabs never shift; ink in light, lime in dark. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-full mt-1.5 h-[3px] rounded-full bg-action-ink transition-opacity duration-150 motion-reduce:transition-none",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </span>
            </Link>
          );
        })}
      </div>
      {/* Fixed 44px slot outside the scroller; the edge fade ends at the scroller's edge. */}
      <div className="relative size-11 shrink-0">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={calendarLabel}
              className="relative grid size-11 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <CalendarIcon aria-hidden className="size-5 text-muted-foreground" />
              <span
                aria-hidden
                className="absolute inset-0 grid place-items-center pt-1 text-[10px] font-bold leading-none"
              >
                {todayNumber}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              required
              selected={parseYmd(selected)}
              defaultMonth={parseYmd(selected)}
              disabled={{ after: parseYmd(maxDate) }}
              onSelect={pickDate}
              locale={locale === "ar" ? ar : enGB}
              dir={locale === "ar" ? "rtl" : "ltr"}
              formatters={{
                formatCaption: (month) =>
                  formatDisplayDate(
                    new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1, 12)),
                    locale,
                    { month: "long", year: "numeric" },
                    "UTC",
                  ),
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function parseYmd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

function ymd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
