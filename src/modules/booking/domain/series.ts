import Decimal from "decimal.js";
import {
  addCalendarDays,
  bookingFitsOpenHours,
  generateSlotsForDay,
  localTimeToUtc,
  localWallClock,
  windowDaysForStart,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import type { ScheduleConfig } from "@/modules/venue/schemas/schedule-config";

/**
 * Weekly recurring bookings. A series is only the link between ordinary APPROVED bookings that
 * are all created up front; this file holds the pure rules (when each week starts, whether a week
 * can be booked, what it costs). No database, no clock of its own.
 */

/** The choices offered to the owner. Default 8. */
export const SERIES_COUNTS = [4, 8, 12] as const;
export const SERIES_DEFAULT_COUNT = 8;
export const SERIES_MAX_DURATION_MINUTES = 180;

export type SeriesCount = (typeof SERIES_COUNTS)[number];

export function isSeriesCount(value: number): value is SeriesCount {
  return (SERIES_COUNTS as readonly number[]).includes(value);
}

/** The local (stadium clock) date and time of week 0. */
export type SeriesAnchor = { date: CivilDate; hour: number; minute: number };

export function anchorFromInstant(start: Date, timeZone: string): SeriesAnchor {
  const wall = localWallClock(start, timeZone);
  return { date: wall.date, hour: wall.hour, minute: wall.minute };
}

/**
 * The starts of weeks `firstIndex` to `firstIndex + count - 1`: the anchor's local wall-clock time
 * on the anchor's date + 7k calendar days, converted to UTC for THAT day. So a 20:00 game stays at
 * 20:00 across the October clock change (the UTC hour moves by one), and a 00:30 game stays on the
 * same night. Week 0 is the anchor itself.
 */
export function seriesOccurrences(
  anchor: SeriesAnchor,
  count: number,
  timeZone: string,
  firstIndex = 0,
): Date[] {
  const starts: Date[] = [];
  for (let k = firstIndex; k < firstIndex + count; k += 1) {
    const date = addCalendarDays(anchor.date, 7 * k);
    starts.push(localTimeToUtc(date, anchor.hour, anchor.minute, timeZone));
  }
  return starts;
}

/** Which week a start is (0 = the anchor's week), from the calendar days between the two dates. */
export function occurrenceIndex(anchor: SeriesAnchor, start: Date, timeZone: string): number {
  const day = localWallClock(start, timeZone).date;
  const days =
    (Date.UTC(day.year, day.month - 1, day.day) -
      Date.UTC(anchor.date.year, anchor.date.month - 1, anchor.date.day)) /
    86_400_000;
  return Math.round(days / 7);
}

/**
 * The length of every game in a series: the pitch's standard game (what the quick booking gives a
 * new booking at a grid time), never the length a source booking happens to have now. An extension
 * belongs to its own week only.
 */
export function standardSeriesMinutes(config: ScheduleConfig): number {
  return config.slotDurationMinutes;
}

/**
 * What one week costs: the price of the grid slot that starts at this time, scaled to the series
 * length (a 90-minute series on a 60-minute grid pays 1.5 slots), half up to cents. Null when no
 * slot starts at that time that day (the hours changed). Priced at its own time and frozen like
 * any owner booking.
 */
export function occurrencePrice(
  config: ScheduleConfig,
  start: Date,
  durationMinutes: number,
  timeZone: string,
): Decimal | null {
  for (const localDate of windowDaysForStart(start, timeZone)) {
    const slot = generateSlotsForDay({ config, localDate, timeZone, occupied: [] }).find(
      (candidate) => candidate.start.getTime() === start.getTime(),
    );
    if (slot) {
      return slot.priceUsd
        .times(durationMinutes)
        .div(config.slotDurationMinutes)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }
  return null;
}

export type OccurrenceState = "free" | "taken" | "outside_hours" | "past";

export type OccurrencePreview = {
  /** Week number, 0 = the anchor's week. */
  index: number;
  start: Date;
  end: Date;
  state: OccurrenceState;
  /** Null unless free. */
  priceUsd: Decimal | null;
  /** Pending requests this week would decline (only counted for a free week). */
  pendingCount: number;
};

type Range = { start: Date; end: Date };

function overlaps(a: Range, b: Range): boolean {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

/** One week's verdict. The same function the preview and the use case use, so they cannot differ. */
export function classifyOccurrence(input: {
  index: number;
  start: Date;
  durationMinutes: number;
  config: ScheduleConfig;
  approved: readonly Range[];
  pending: readonly Range[];
  now: Date;
  timeZone: string;
}): OccurrencePreview {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);
  const base = { index: input.index, start: input.start, end, priceUsd: null, pendingCount: 0 };
  if (input.start.getTime() <= input.now.getTime()) return { ...base, state: "past" };

  const price = occurrencePrice(input.config, input.start, input.durationMinutes, input.timeZone);
  if (price === null || !bookingFitsOpenHours(input.config, { start: input.start, end }, input.timeZone)) {
    return { ...base, state: "outside_hours" };
  }
  const range = { start: input.start, end };
  if (input.approved.some((taken) => overlaps(taken, range))) return { ...base, state: "taken" };

  return {
    ...base,
    state: "free",
    priceUsd: price,
    pendingCount: input.pending.filter((request) => overlaps(request, range)).length,
  };
}

/** The preview list: every week with its state. */
export function buildSeriesPreview(input: {
  starts: readonly Date[];
  firstIndex?: number;
  durationMinutes: number;
  config: ScheduleConfig;
  approved: readonly Range[];
  pending: readonly Range[];
  now: Date;
  timeZone: string;
}): OccurrencePreview[] {
  return input.starts.map((start, offset) =>
    classifyOccurrence({
      index: (input.firstIndex ?? 0) + offset,
      start,
      durationMinutes: input.durationMinutes,
      config: input.config,
      approved: input.approved,
      pending: input.pending,
      now: input.now,
      timeZone: input.timeZone,
    }),
  );
}

/** How many games the primary button will say: the weeks that are free. */
export function bookableCount(preview: readonly OccurrencePreview[]): number {
  return preview.filter((item) => item.state === "free").length;
}

/** Sum of the pending requests the free weeks would decline. */
export function declineTotal(preview: readonly OccurrencePreview[]): number {
  return preview.reduce((sum, item) => sum + (item.state === "free" ? item.pendingCount : 0), 0);
}

/** Weekday and clock of the series for labels: 0 = Sunday ... 6 = Saturday, and "HH:mm". */
export function seriesWeekdayAndTime(anchor: SeriesAnchor): { weekday: number; time: string } {
  const weekday = new Date(Date.UTC(anchor.date.year, anchor.date.month - 1, anchor.date.day)).getUTCDay();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { weekday, time: `${pad(anchor.hour)}:${pad(anchor.minute)}` };
}

export function parseAnchorTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}
