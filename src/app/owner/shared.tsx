import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { ui } from "@/lib/ui-copy";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";
import {
  parseLedgerPeriodQuery,
  type LedgerPeriodQuery,
} from "@/modules/ledger/schemas/period-query";
import type { CivilDate } from "@/modules/venue/domain/availability";

export const OWNER_TIME_ZONE = "Asia/Beirut";

export function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function tenantSlugFrom(
  params: { tenant?: string | string[] },
  fallback: string,
): string {
  return typeof params.tenant === "string" && params.tenant.length > 0
    ? params.tenant
    : fallback;
}

export async function requireOwnerMembership(
  tenantSlug: string,
): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    const next = new URLSearchParams();
    next.set("tenant", tenantSlug);
    redirect(`/login?${next.toString()}`);
  }
  return membership;
}

export function readPeriodQuery(params: {
  from?: string | string[];
  to?: string | string[];
  view?: string | string[];
  displayRate?: string | string[];
}): LedgerPeriodQuery {
  try {
    return parseLedgerPeriodQuery({
      from: queryString(params.from),
      to: queryString(params.to),
      view: queryString(params.view),
      displayRate: queryString(params.displayRate),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        from: undefined,
        to: undefined,
        view: "usd",
        displayRate: undefined,
      };
    }
    throw error;
  }
}

export function parseOwnerBookOn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    civilFromYyyyMmDd(value);
    return value;
  } catch {
    return undefined;
  }
}

export function keepTenantQuery(tenantSlug: string) {
  return <input type="hidden" name="tenant" value={tenantSlug} />;
}

export function keepBookQuery(tenantSlug: string, bookOn: string) {
  return (
    <>
      <input type="hidden" name="tenant" value={tenantSlug} />
      <input type="hidden" name="bookOn" value={bookOn} />
    </>
  );
}

export function keepPeriodQuery(
  tenantSlug: string,
  period: LedgerPeriodQuery,
) {
  return (
    <>
      <input type="hidden" name="tenant" value={tenantSlug} />
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

export function categoryLabel(category: ExpenseCategory): string {
  return ui(`cat.${category}`);
}
