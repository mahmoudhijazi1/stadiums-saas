import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import type { HoursGroup } from "@/modules/venue/domain/daily-schedule";
import { WEEKDAYS, type Weekday } from "@/modules/venue/schemas/schedule-config";

/**
 * Pure conversions between the stored pitch config (hours groups, price rules) and the
 * simple model the pitch editor shows: seven day rows and non-overlapping price cards.
 * Nothing here changes what the engine computes: converting there and back gives the same
 * slots and prices (test/modules/venue/domain/pitch-form-model.test.ts proves it on 500
 * generated configs). No UI, no database.
 */

export const DEFAULT_FROM = "16:00";
export const DEFAULT_TO = "23:00";

export type DayRow = {
  day: Weekday;
  open: boolean;
  /** `HH:mm`. Kept while closed, so switching a day back on restores the times. */
  from: string;
  to: string;
};

/** Seven rows, Monday to Sunday. A day in no group is closed. */
export function hoursToRows(groups: readonly HoursGroup[]): DayRow[] {
  const first = groups[0];
  const fallback = { from: first?.open ?? DEFAULT_FROM, to: first?.close ?? DEFAULT_TO };
  return WEEKDAYS.map((day) => {
    const group = groups.find((item) => item.days.includes(day));
    return group
      ? { day, open: true, from: group.open, to: group.close }
      : { day, open: false, ...fallback };
  });
}

/** Hours groups for the stored format: open days with identical windows share a group. */
export function rowsToHours(rows: readonly DayRow[]): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const day of WEEKDAYS) {
    const row = rows.find((item) => item.day === day);
    if (!row || !row.open) continue;
    const existing = groups.find((group) => group.open === row.from && group.close === row.to);
    if (existing) existing.days.push(day);
    else groups.push({ days: [day], open: row.from, close: row.to });
  }
  return groups;
}

/** The editor's "Same hours every day": the first open day's times on all days. */
export function sameHoursEveryDay(rows: readonly DayRow[]): DayRow[] {
  const source = rows.find((row) => row.open) ?? rows[0];
  if (!source) return [...rows];
  return rows.map((row) => ({ ...row, open: true, from: source.from, to: source.to }));
}

/** Close at or before open means the window runs into the next day (BR-7). */
export function crossesMidnight(from: string, to: string): boolean {
  return to <= from;
}

// ---------------------------------------------------------------------------
// Prices

export type PriceRule = {
  days: Weekday[];
  priceUsd: string;
  start?: string;
  end?: string;
};

/** A price for some days, any time of day. Each day is in at most one card. */
export type DayPriceCard = { days: Weekday[]; priceUsd: string };

/**
 * A rule with a time range. The editor has no control for it, so it is kept as it is and
 * shown read-only. `at` is how many day cards came before it, which keeps its place in the
 * "last matching rule wins" order.
 */
export type TimedRule = { rule: PriceRule; at: number };

function hasRange(rule: PriceRule): boolean {
  return rule.start !== undefined && rule.end !== undefined;
}

/**
 * Split stored rules into non-overlapping day cards and the rules the cards cannot
 * express. The engine lets the last matching rule win, so a day that a LATER all-day
 * rule also covers is removed from the earlier one: that price was never visible. The
 * result prices every day and time exactly as before.
 */
export function rulesToPriceCards(rules: readonly PriceRule[]): {
  cards: DayPriceCard[];
  timed: TimedRule[];
} {
  const covered = new Set<Weekday>();
  const trimmed = new Map<number, Weekday[]>();
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index]!;
    if (hasRange(rule)) continue;
    trimmed.set(index, WEEKDAYS.filter((day) => rule.days.includes(day) && !covered.has(day)));
    for (const day of rule.days) covered.add(day);
  }

  const cards: DayPriceCard[] = [];
  const timed: TimedRule[] = [];
  rules.forEach((rule, index) => {
    if (hasRange(rule)) {
      timed.push({ rule: { ...rule, days: [...rule.days] }, at: cards.length });
      return;
    }
    const days = trimmed.get(index) ?? [];
    if (days.length > 0) cards.push({ days, priceUsd: rule.priceUsd });
  });
  return { cards, timed };
}

/** Back to stored rules, putting each kept timed rule where it was among the cards. */
export function priceCardsToRules(
  cards: readonly DayPriceCard[],
  timed: readonly TimedRule[],
): PriceRule[] {
  const out: PriceRule[] = [];
  const pending = [...timed].sort((a, b) => a.at - b.at);
  cards.forEach((card, index) => {
    while (pending.length > 0 && pending[0]!.at <= index) out.push(pending.shift()!.rule);
    out.push({ days: WEEKDAYS.filter((day) => card.days.includes(day)), priceUsd: card.priceUsd });
  });
  for (const item of pending) out.push(item.rule);
  return out;
}

// ---------------------------------------------------------------------------
// Summary

export type HourCycleChoice = "h12" | "h23";

/** "4:00 PM" / "16:00"; Arabic uses م and ص. Digits stay Western. */
export function formatClock(
  hhmm: string,
  hourCycle: HourCycleChoice,
  locale: UiLocale,
): string {
  const [hour, minute] = hhmm.split(":").map(Number) as [number, number];
  if (hourCycle === "h23") return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const period = hour < 12 ? (locale === "en" ? "AM" : "ص") : locale === "en" ? "PM" : "م";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatWindow(from: string, to: string, hourCycle: HourCycleChoice, locale: UiLocale): string {
  const a = formatClock(from, hourCycle, locale);
  const b = formatClock(to, hourCycle, locale);
  if (hourCycle === "h12") {
    const samePeriod = a.split(" ")[1] === b.split(" ")[1];
    if (samePeriod && !crossesMidnight(from, to)) {
      return `${a.split(" ")[0]}–${b}`;
    }
  }
  return `${a}–${b}`;
}

/** Runs of consecutive weekdays (Monday first): Mon, Tue, Wed, Fri -> [[Mon..Wed], [Fri]]. */
function dayRuns(days: readonly Weekday[]): Weekday[][] {
  const runs: Weekday[][] = [];
  for (const day of WEEKDAYS.filter((item) => days.includes(item))) {
    const last = runs.at(-1);
    if (last && WEEKDAYS.indexOf(day) === WEEKDAYS.indexOf(last.at(-1)!) + 1) last.push(day);
    else runs.push([day]);
  }
  return runs;
}

/** "Mon–Thu", "Fri", "Fri–Sat", or "every day" when all seven days are given. */
export function formatDays(days: readonly Weekday[], locale: UiLocale): string {
  if (days.length === 7) return ui("owner.pitchEveryDay", locale);
  const separator = locale === "ar" ? "، " : ", ";
  return dayRuns(days)
    .map((run) =>
      run.length === 1
        ? ui(`owner.wd.${run[0]!}`, locale)
        : `${ui(`owner.wd.${run[0]!}`, locale)}–${ui(`owner.wd.${run.at(-1)!}`, locale)}`,
    )
    .join(separator);
}

/**
 * One line for a pitch: "Mon–Thu 4:00–10:00 PM · Fri–Sat until 11:00 PM · Sun closed".
 * A later group that opens at the first group's time says "until <close>". Closed days
 * are listed last, compressed the same way.
 */
export function formatHoursSummary(
  rows: readonly DayRow[],
  locale: UiLocale,
  hourCycle: HourCycleChoice = "h12",
): string {
  const groups = rowsToHours(rows);
  if (groups.length === 0) return ui("owner.pitchAllClosed", locale);

  const parts = groups.map((group, index) => {
    const days = formatDays(group.days, locale);
    const sameOpening = index > 0 && group.open === groups[0]!.open;
    const times = sameOpening
      ? `${ui("owner.pitchUntil", locale)} ${formatClock(group.close, hourCycle, locale)}`
      : formatWindow(group.open, group.close, hourCycle, locale);
    return `${days} ${times}`;
  });

  const closed = WEEKDAYS.filter((day) => !rows.find((row) => row.day === day)?.open);
  if (closed.length > 0) {
    parts.push(`${formatDays(closed, locale)} ${ui("owner.pitchClosed", locale)}`);
  }
  return parts.join(" · ");
}
