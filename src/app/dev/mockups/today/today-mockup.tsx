"use client";

import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { BookingBlock } from "@/components/day-grid/booking-block";
import { DayGrid, minuteToPx, type GridGeometry } from "@/components/day-grid/day-grid";
import { FreeCell } from "@/components/day-grid/free-cell";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatLocalHm, shortPeriodOf } from "@/lib/format-local-hm";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { cn } from "cn";
import { bookingTone, fakeDay, freeSlots } from "./data";

const GEOMETRY: GridGeometry = { startMin: 16 * 60, rowMin: 30, rowPx: 32 };
const END_MIN = 22 * 60;
const COLUMNS_MAX = 3;

/** Local Beirut minutes to a clock in the tenant format (12-hour here). */
function clock(minute: number, locale: UiLocale): { digits: string; period: string } {
  const instant = new Date(Date.UTC(2026, 9, 1, 0, minute - 180));
  const text = formatLocalHm(instant, "Asia/Beirut", "h12", locale);
  const [digits = text, period = ""] = text.split(" ");
  return { digits, period: shortPeriodOf(period) };
}

function Clock({ minute, locale }: { minute: number; locale: UiLocale }) {
  const { digits, period } = clock(minute, locale);
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <LtrIsolate>{digits}</LtrIsolate>
      <span className="text-[10px]">{period}</span>
    </span>
  );
}

function clockText(minute: number, locale: UiLocale): string {
  const { digits, period } = clock(minute, locale);
  return `${digits} ${period}`;
}

export function TodayMockup({
  locale,
  pitchCount,
  nowOverride,
}: {
  locale: UiLocale;
  pitchCount: number;
  nowOverride: number | null;
}) {
  const { pitches, bookings, defaultNow } = fakeDay(pitchCount);
  const nowMin = nowOverride ?? defaultNow;
  const free = freeSlots(pitches, bookings, nowMin);
  const [filter, setFilter] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);

  const filtering = pitches.length > COLUMNS_MAX;
  const visible = filtering
    ? filter
      ? pitches.filter((p) => p.id === filter)
      : pitches.slice(0, COLUMNS_MAX)
    : pitches;

  const owed = bookings.filter((b) => bookingTone(b, nowMin) === "owed");
  const owedTotal = owed.reduce((sum, b) => sum + (b.priceUsd - b.paidUsd), 0);
  const played = bookings.filter((b) => nowMin !== null && b.startMin + b.durationMin <= nowMin);
  const expectedTotal = bookings
    .filter((b) => bookingTone(b, nowMin) === "expected")
    .reduce((sum, b) => sum + b.priceUsd, 0);
  const requests = 2;

  const pitchName = (id: string) => pitches.find((p) => p.id === id)?.name ?? id;

  return (
    <section
      className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-4 py-6"
      aria-label="Today grid mockup"
    >
      <h1 className="font-display text-3xl leading-none font-extrabold">
        {formatDisplayDate(new Date(Date.UTC(2026, 9, 1, 9)), locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </h1>

      {requests > 0 ? (
        <button
          type="button"
          onClick={() => alert("open Requests")}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-start text-sm font-medium"
        >
          <Bell aria-hidden className="size-5 shrink-0" />
          <span className="flex-1">{uiCount("owner.requests", requests, locale)}</span>
        </button>
      ) : null}

      {owed.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={collectOpen}
            onClick={() => setCollectOpen((open) => !open)}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-owed/60 bg-owed-subtle px-4 py-3 text-start text-sm font-medium text-owed"
          >
            <span className="flex-1">
              {uiCount("owner.toCollectGames", owed.length, locale)}
              <span aria-hidden> · </span>
              <LtrIsolate>${owedTotal}</LtrIsolate>
            </span>
            <ChevronDown aria-hidden className={cn("size-5", collectOpen && "rotate-180")} />
          </button>
          {collectOpen ? (
            <ul className="flex flex-col gap-2 text-sm">
              {owed.map((b) => (
                <li key={b.id} className="rounded-lg border bg-card px-3 py-2">
                  {b.name} · {pitchName(b.pitchId)}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {uiCount("owner.gamesPlayed", played.length, locale)}
        <span aria-hidden> · </span>
        {uiCount("owner.gamesUpcoming", bookings.length - played.length, locale)}
        {expectedTotal > 0 ? (
          <>
            <span aria-hidden> · </span>
            {ui("owner.expectedLabel", locale)} <LtrIsolate>${expectedTotal}</LtrIsolate>
          </>
        ) : null}
      </p>

      {filtering ? (
        <ul className="flex flex-wrap gap-2">
          {[null, ...pitches].map((pitch) => {
            const active = (pitch?.id ?? null) === filter;
            return (
              <li key={pitch?.id ?? "all"}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(pitch?.id ?? null)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3 text-sm",
                    active
                      ? "border-accent-brand bg-accent-brand text-accent-ink"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {pitch ? pitch.name : ui("owner.allPitches", locale)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <DayGrid
        geometry={GEOMETRY}
        endMin={END_MIN}
        nowMin={nowMin}
        nowLabel={ui("owner.nowLabel", locale)}
        closedLabel={ui("owner.closedCell", locale)}
        axisLabel={(minute) => <Clock minute={minute} locale={locale} />}
        columns={visible.map((pitch) => ({
          id: pitch.id,
          name: pitch.name,
          caption: `${ui("owner.gameWord", locale)} $${pitch.priceUsd}`,
          openStartMin: pitch.openStartMin,
          openEndMin: pitch.openEndMin,
          items: (
            <>
              {bookings
                .filter((b) => b.pitchId === pitch.id)
                .map((b) => {
                  const tone = bookingTone(b, nowMin);
                  const amount = tone === "paid" ? b.paidUsd : b.priceUsd - b.paidUsd;
                  return (
                    <BookingBlock
                      key={b.id}
                      name={b.name}
                      tone={tone}
                      statusLabel={ui(
                        tone === "paid"
                          ? "owner.paid"
                          : tone === "owed"
                            ? "owner.owedLabel"
                            : "owner.expectedLabel",
                        locale,
                      )}
                      amountLabel={`$${amount}`}
                      topPx={minuteToPx(b.startMin, GEOMETRY) + 1}
                      heightPx={
                        minuteToPx(b.startMin + b.durationMin, GEOMETRY) -
                        minuteToPx(b.startMin, GEOMETRY) -
                        2
                      }
                      onSelect={() => alert("open booking sheet")}
                    />
                  );
                })}
              {free
                .filter((s) => s.pitchId === pitch.id)
                .map((s) => (
                  <FreeCell
                    key={s.startMin}
                    ariaLabel={`${clockText(s.startMin, locale)} ${pitch.name}`}
                    topPx={minuteToPx(s.startMin, GEOMETRY) + 1}
                    heightPx={
                      minuteToPx(s.startMin + s.durationMin, GEOMETRY) -
                      minuteToPx(s.startMin, GEOMETRY) -
                      2
                    }
                    onSelect={() => alert(`book ${String(Math.floor(s.startMin / 60)).padStart(2, "0")}:${String(s.startMin % 60).padStart(2, "0")} ${pitch.name}`)}
                  />
                ))}
            </>
          ),
        }))}
      />
    </section>
  );
}
