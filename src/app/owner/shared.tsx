import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import { EXPENSE_CATEGORIES } from "@/modules/expense/domain/categories";
import type { CivilDate } from "@/modules/venue/domain/availability";

export const OWNER_TIME_ZONE = "Asia/Beirut";

export function keepOwnerQuery(
  tenantSlug: string,
  bookOn: string,
  period: LedgerPeriodQuery,
) {
  return (
    <>
      <input type="hidden" name="tenant" value={tenantSlug} />
      <input type="hidden" name="bookOn" value={bookOn} />
      {period.from ? (
        <input type="hidden" name="from" value={period.from} />
      ) : null}
      {period.to ? <input type="hidden" name="to" value={period.to} /> : null}
      {period.view !== "usd" ? (
        <input type="hidden" name="view" value={period.view} />
      ) : null}
      {period.displayRate ? (
        <input type="hidden" name="displayRate" value={period.displayRate} />
      ) : null}
    </>
  );
}

export function formatLocalRange(start: Date, end: Date): string {
  return `${formatLocalTime(start)}–${formatLocalTime(end)} (${OWNER_TIME_ZONE})`;
}

export function formatLocalTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function formatLocalDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(value);
}

export function formatLocalDay(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: OWNER_TIME_ZONE,
    dateStyle: "medium",
  }).format(value);
}

export function civilFromYyyyMmDd(value: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid bookOn "${value}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid bookOn "${value}"`);
  }
  return { year, month, day };
}

export function categoryLabel(
  category: (typeof EXPENSE_CATEGORIES)[number],
): string {
  switch (category) {
    case "ELECTRICITY":
      return "Electricity";
    case "WATER":
      return "Water";
    case "MAINTENANCE":
      return "Maintenance";
    case "SALARY":
      return "Salary";
    case "EQUIPMENT":
      return "Equipment";
    case "OTHER":
      return "Other";
  }
}
