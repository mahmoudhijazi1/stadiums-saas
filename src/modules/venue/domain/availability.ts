import Decimal from "decimal.js";
import { parseUsd } from "@/lib/money";
import type { ScheduleConfig, Weekday } from "@/modules/venue/schemas/schedule-config";

/**
 * Pure availability engine (SPEC-02 step 3 / DR-002 §2.5).
 * No database, no await, no Prisma. Slots are computed, never stored.
 */

export type CivilDate = { year: number; month: number; day: number };

export type OccupiedRange = { start: Date; end: Date };

export type Slot = {
  start: Date;
  end: Date;
  priceUsd: Decimal;
  available: boolean;
};

/** JS getUTCDay(): 0 = Sunday */
const WEEKDAY_BY_UTC_DAY: Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function generateSlotsForDay(input: {
  config: ScheduleConfig;
  localDate: CivilDate;
  timeZone: string;
  occupied: OccupiedRange[];
}): Slot[] {
  const weekday = weekdayOfCivilDate(input.localDate);
  const windows = input.config.hours[weekday];
  const durationMs = input.config.slotDurationMinutes * 60_000;
  const gapMs = input.config.gapMinutes * 60_000;
  const slots: Slot[] = [];

  for (const window of windows) {
    const range = windowToUtcRange(window.start, window.end, input.localDate, input.timeZone);
    let cursor = range.start.getTime();
    const rangeEnd = range.end.getTime();

    while (cursor + durationMs <= rangeEnd) {
      const start = new Date(cursor);
      const end = new Date(cursor + durationMs);
      slots.push({
        start,
        end,
        priceUsd: priceForSlot(input.config, start, input.timeZone),
        available: !isOccupied(start, end, input.occupied),
      });
      cursor += durationMs + gapMs;
    }
  }

  return slots;
}

function weekdayOfCivilDate(date: CivilDate): Weekday {
  const utcDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return WEEKDAY_BY_UTC_DAY[utcDay]!;
}

function windowToUtcRange(
  startClock: string,
  endClock: string,
  localDate: CivilDate,
  timeZone: string,
): { start: Date; end: Date } {
  const startMinutes = hhmmToMinutes(startClock);
  const endMinutes = hhmmToMinutes(endClock);
  const startParts = splitHhmm(startClock);
  const endParts = splitHhmm(endClock);
  // end <= start → crosses midnight onto the next civil day (BR-7)
  const endDate =
    startMinutes < endMinutes ? localDate : addCalendarDays(localDate, 1);

  return {
    start: zonedLocalToUtc(localDate, startParts.hour, startParts.minute, timeZone),
    end: zonedLocalToUtc(endDate, endParts.hour, endParts.minute, timeZone),
  };
}

function priceForSlot(config: ScheduleConfig, start: Date, timeZone: string): Decimal {
  const wall = zonedWallClock(start, timeZone);
  let price = parseUsd(config.defaultPriceUsd);

  for (const rule of config.priceRules) {
    if (!rule.days.includes(wall.weekday)) continue;
    if (rule.start !== undefined && rule.end !== undefined) {
      if (!clockLiesInWindow(wall.minutes, rule.start, rule.end)) continue;
    }
    price = parseUsd(rule.priceUsd);
  }

  return price;
}

function isOccupied(start: Date, end: Date, occupied: OccupiedRange[]): boolean {
  return occupied.some(
    (range) => start.getTime() < range.end.getTime() && end.getTime() > range.start.getTime(),
  );
}

/** Half-open [start, end). Midnight-crossing: end <= start means wrap past midnight. */
function clockLiesInWindow(slotMinutes: number, startClock: string, endClock: string): boolean {
  const start = hhmmToMinutes(startClock);
  const end = hhmmToMinutes(endClock);
  if (start < end) {
    return slotMinutes >= start && slotMinutes < end;
  }
  return slotMinutes >= start || slotMinutes < end;
}

function addCalendarDays(date: CivilDate, days: number): CivilDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function splitHhmm(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

function hhmmToMinutes(value: string): number {
  const { hour, minute } = splitHhmm(value);
  return hour * 60 + minute;
}

/**
 * Interpret a wall-clock time in `timeZone` as a UTC instant.
 * Uses Intl offsets (not Date#getHours) so Asia/Beirut DST is respected.
 */
function zonedLocalToUtc(
  date: CivilDate,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  const offsetMs = tzOffsetMs(new Date(asUtc), timeZone);
  const candidate = new Date(asUtc - offsetMs);
  const correctedOffset = tzOffsetMs(candidate, timeZone);
  return new Date(asUtc - correctedOffset);
}

function zonedWallClock(
  instant: Date,
  timeZone: string,
): { weekday: Weekday; minutes: number } {
  const parts = zonedParts(instant, timeZone);
  const civil: CivilDate = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
  return {
    weekday: weekdayOfCivilDate(civil),
    minutes: parts.hour * 60 + parts.minute,
  };
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallAsUtc - instant.getTime();
}

function zonedParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}
