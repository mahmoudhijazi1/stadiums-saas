import { formatUsd, normalizeUsdForm, parseUsd } from "@/lib/money";
import { DomainError } from "@/lib/errors";
import {
  WEEKDAYS,
  parseScheduleConfig,
  type ScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";

export type HoursGroup = {
  days: Weekday[];
  open: string;
  close: string;
};

/**
 * Collapse stored per-day hours into form rows. Identical window arrays
 * share a row. Empty [] days are closed, not a row.
 * A day with two windows still becomes one row using window[0] (known limit).
 */
export function collapseHoursGroups(
  hours: ScheduleConfig["hours"],
): { groups: HoursGroup[]; closed: Weekday[] } {
  const groups: HoursGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const day of WEEKDAYS) {
    const windows = hours[day];
    if (windows.length === 0) continue;
    const key = JSON.stringify(windows);
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      groups[existing]!.days.push(day);
      continue;
    }
    const first = windows[0]!;
    indexByKey.set(key, groups.length);
    groups.push({ days: [day], open: first.start, close: first.end });
  }

  return { groups, closed: closedDaysFromGroups(groups) };
}

export function closedDaysFromGroups(groups: HoursGroup[]): Weekday[] {
  const taken = new Set(groups.flatMap((group) => group.days));
  return WEEKDAYS.filter((day) => !taken.has(day));
}

export function assertUniqueHoursDays(groups: HoursGroup[]): void {
  const seen = new Set<Weekday>();
  for (const group of groups) {
    for (const day of group.days) {
      if (seen.has(day)) {
        throw new DomainError("venue.hours_day_overlap");
      }
      seen.add(day);
    }
  }
}

/**
 * Expand hours groups onto all seven days. Days in no group stay [].
 * gap 0 always. parseScheduleConfig is the write shape.
 */
export function scheduleFromHoursGroups(input: {
  groups: HoursGroup[];
  slotDurationMinutes: number;
  defaultPriceUsd: string;
  priceRules?: ScheduleConfig["priceRules"];
}): ScheduleConfig {
  assertUniqueHoursDays(input.groups);
  const hours: ScheduleConfig["hours"] = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
  for (const group of input.groups) {
    const window = [{ start: group.open, end: group.close }];
    for (const day of group.days) {
      hours[day] = window;
    }
  }
  return parseScheduleConfig({
    slotDurationMinutes: input.slotDurationMinutes,
    gapMinutes: 0,
    hours,
    defaultPriceUsd: formatUsd(
      parseUsd(normalizeUsdForm(input.defaultPriceUsd)),
    ),
    priceRules: input.priceRules ?? [],
  });
}

/** Convenience for tests: one window on every weekday. */
export function scheduleFromDailyWindow(input: {
  open: string;
  close: string;
  slotDurationMinutes: number;
  defaultPriceUsd: string;
  priceRules?: ScheduleConfig["priceRules"];
}): ScheduleConfig {
  return scheduleFromHoursGroups({
    groups: [
      {
        days: [...WEEKDAYS],
        open: input.open,
        close: input.close,
      },
    ],
    slotDurationMinutes: input.slotDurationMinutes,
    defaultPriceUsd: input.defaultPriceUsd,
    priceRules: input.priceRules,
  });
}

export function defaultHoursGroups(): HoursGroup[] {
  return [
    {
      days: [...WEEKDAYS],
      open: "16:00",
      close: "22:00",
    },
  ];
}
