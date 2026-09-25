import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  formatLocalHm,
  type ClockLocale,
  type HourCycle,
} from "@/lib/format-local-hm";

export const OWNER_TIME_ZONE = "Asia/Beirut";
export type { ClockLocale, HourCycle };

export function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function requireOwnerMembership(): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/owner/login");
  }
  return membership;
}

export function formatLocalRange(
  start: Date,
  end: Date,
  hourCycle: HourCycle = "h23",
  locale: ClockLocale = "en",
): string {
  return `${formatLocalClock(start, hourCycle, locale)}–${formatLocalClock(end, hourCycle, locale)} (${OWNER_TIME_ZONE})`;
}

/** Time range without the zone name (Home compact rows). */
export function formatLocalClockRange(
  start: Date,
  end: Date,
  hourCycle: HourCycle = "h23",
  locale: ClockLocale = "en",
): string {
  return `${formatLocalClock(start, hourCycle, locale)}–${formatLocalClock(end, hourCycle, locale)}`;
}

export function formatLocalClock(
  value: Date,
  hourCycle: HourCycle = "h23",
  locale: ClockLocale = "en",
): string {
  return formatLocalHm(value, OWNER_TIME_ZONE, hourCycle, locale);
}
