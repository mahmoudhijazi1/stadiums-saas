"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { cn } from "cn";
import type { DayTab } from "@/modules/booking/domain/day-tabs";

/**
 * Horizontally scrollable day tabs. Past sits on the right in Arabic, future on the left
 * (flex follows the document direction). The selected tab is centred on load.
 */
export function DayTabs({
  tabs,
  selected,
  todayDate,
  todayNumber,
  maxDate,
  calendarLabel,
}: {
  tabs: DayTab[];
  selected: string;
  todayDate: string;
  todayNumber: number;
  maxDate: string;
  calendarLabel: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const shift = tabBox.left + tabBox.width / 2 - (listBox.left + listBox.width / 2);
    list.scrollBy({ left: shift, behavior: "auto" });
  }, [selected]);

  function pickDate(value: string) {
    if (!value || value > maxDate) return;
    router.push(value === todayDate ? "/owner/today" : `/owner/today?date=${value}`);
  }

  return (
    <div className="flex items-center gap-1">
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
        {tabs.map((tab) => {
          const active = tab.date === selected;
          return (
            <Link
              key={tab.date}
              role="tab"
              aria-selected={active}
              aria-current={tab.kind === "today" ? "date" : undefined}
              scroll={false}
              href={tab.kind === "today" ? "/owner/today" : `/owner/today?date=${tab.date}`}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center justify-center px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex flex-col items-center">
                {/* The after: copy is bold and invisible, so selecting a tab never changes its width. */}
                <span
                  data-label={tab.label}
                  className="whitespace-nowrap after:invisible after:block after:h-0 after:overflow-hidden after:font-bold after:content-[attr(data-label)]"
                >
                  {tab.label}
                </span>
                {/* Active marker. Always rendered so tabs never shift; ink in light, lime in dark. */}
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-[3px] w-3/5 rounded-full bg-action-ink transition-opacity duration-150 motion-reduce:transition-none",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </span>
            </Link>
          );
        })}
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={calendarLabel}
          onClick={() => {
            const input = dateRef.current;
            if (!input) return;
            try {
              input.showPicker();
            } catch {
              input.focus();
              input.click();
            }
          }}
          className="relative grid size-11 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Calendar aria-hidden className="size-6 text-muted-foreground" />
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center pt-1 text-[10px] font-bold leading-none"
          >
            {todayNumber}
          </span>
        </button>
        <input
          ref={dateRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          max={maxDate}
          defaultValue={selected}
          onChange={(event) => pickDate(event.target.value)}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>
    </div>
  );
}
