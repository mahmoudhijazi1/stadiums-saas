"use client";

import { useState, type ReactNode } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { BookingCard } from "@/components/day-sheet/booking-card";
import { buildDaySheet, freeCount, type SheetRow } from "@/components/day-sheet/build-day-sheet";
import { DaySheet, NowDivider } from "@/components/day-sheet/day-sheet";
import { FreeRow } from "@/components/day-sheet/free-row";
import { PitchSwitcher } from "@/components/day-sheet/pitch-switcher";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatLocalHm, shortPeriodOf } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import { cn } from "cn";
import { bookingTone, FAKE_NOW_MIN, fakeDay } from "./data";

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
    <span className="inline-flex items-baseline gap-1">
      <LtrIsolate>{digits}</LtrIsolate>
      <span className="text-[10px]">{period}</span>
    </span>
  );
}

function plainClock(minute: number): string {
  const { digits, period } = clock(minute, "en");
  return `${digits} ${period}`;
}

export function TodayMockup({
  locale,
  pitchCount,
  pitchParam,
  closed,
  dayStrip,
}: {
  /** The live OwnerDayStrip, rendered by the page (it is a server component). */
  dayStrip: ReactNode;
  locale: UiLocale;
  pitchCount: number;
  pitchParam: string | null;
  closed: boolean;
}) {
  const nowMin = FAKE_NOW_MIN;
  const { pitches, bookings, pending } = fakeDay(pitchCount, closed);
  const selected = pitches.find((p) => p.id === pitchParam) ?? pitches[0]!;
  const [collectOpen, setCollectOpen] = useState(false);

  const sheets = pitches.map((pitch) => ({
    pitch,
    rows: buildDaySheet(pitch, bookings, pending[pitch.id] ?? new Map(), nowMin),
  }));
  const current = sheets.find((s) => s.pitch.id === selected.id)!;

  const owed = bookings.filter((b) => bookingTone(b, nowMin) === "owed");
  const owedTotal = owed.reduce((sum, b) => sum + (b.priceUsd - b.paidUsd), 0);
  const played = bookings.filter((b) => b.startMin + b.durationMin <= nowMin);
  const expectedTotal = bookings
    .filter((b) => bookingTone(b, nowMin) === "expected")
    .reduce((sum, b) => sum + b.priceUsd, 0);
  const requests = 2;

  const toRow = (row: SheetRow) => {
    if (row.kind === "now") {
      return {
        key: "now",
        node: <NowDivider label={ui("owner.nowLabel", locale)} />,
      };
    }
    if (row.kind === "booking") {
      const b = row.booking;
      const tone = bookingTone(b, nowMin);
      return {
        key: b.id,
        time: <Clock minute={row.startMin} locale={locale} />,
        node: (
          <BookingCard
            name={b.name}
            tone={tone}
            statusLabel={ui(
              tone === "paid" ? "owner.paid" : tone === "owed" ? "owner.owedLabel" : "owner.expectedLabel",
              locale,
            )}
            gameLabel={`${ui("owner.gameWord", locale)} $${b.priceUsd}`}
            onSelect={() => alert("open booking sheet")}
          />
        ),
      };
    }
    return {
      key: `free-${row.startMin}`,
      compact: true,
      time: <Clock minute={row.startMin} locale={locale} />,
      node: (
        <FreeRow
          bookLabel={ui("owner.book", locale)}
          ariaLabel={`${plainClock(row.startMin)} ${selected.name}`}
          priceLabel={row.priceUsd !== selected.priceUsd ? `$${row.priceUsd}` : null}
          pending={row.pending}
          pendingLabel={uiCount("owner.requests", row.pending, locale)}
          onSelect={() => alert(`book ${plainClock(row.startMin)}`)}
        />
      ),
    };
  };

  const mapped = current.rows.map(toRow);

  return (
    <section
      className="mx-auto flex w-full max-w-[420px] flex-col gap-4 px-4 py-6"
      aria-label="Today day sheet mockup"
    >
      {dayStrip}

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
                  {b.name}
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

      {pitches.length > 1 ? (
        <PitchSwitcher
          label={ui("owner.freeStrip", locale)}
          selectedId={selected.id}
          items={sheets.map(({ pitch, rows }) => ({
            id: pitch.id,
            href: `?pitches=${pitchCount}&pitch=${pitch.id}`,
            label: `${pitch.name} · ${uiCount("owner.freeCount", freeCount(rows), locale)}`,
          }))}
        />
      ) : null}

      {closed ? (
        <p className="text-sm text-muted-foreground">{ui("owner.closedCell", locale)}</p>
      ) : (
        <DaySheet label={selected.name} rows={mapped} />
      )}
    </section>
  );
}
