import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  formatLocalHm,
  type HourCycle,
} from "@/lib/format-local-hm";

export const OWNER_TIME_ZONE = "Asia/Beirut";
export type { HourCycle };

export function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function requireOwnerMembership(): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/login");
  }
  return membership;
}

export function formatLocalRange(
  start: Date,
  end: Date,
  hourCycle: HourCycle = "h23",
): string {
  return `${formatLocalClock(start, hourCycle)}–${formatLocalClock(end, hourCycle)} (${OWNER_TIME_ZONE})`;
}

/** Time range without the zone name (Home compact rows). */
export function formatLocalClockRange(
  start: Date,
  end: Date,
  hourCycle: HourCycle = "h23",
): string {
  return `${formatLocalClock(start, hourCycle)}–${formatLocalClock(end, hourCycle)}`;
}

export function formatLocalClock(
  value: Date,
  hourCycle: HourCycle = "h23",
): string {
  return formatLocalHm(value, OWNER_TIME_ZONE, hourCycle);
}
