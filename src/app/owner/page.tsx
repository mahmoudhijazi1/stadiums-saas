import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ZodError } from "zod";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import {
  parseLedgerPeriodQuery,
  type LedgerPeriodQuery,
} from "@/modules/ledger/schemas/period-query";
import {
  BookSlotsSkeleton,
  OwnerRestSkeleton,
  TodayListsSkeleton,
} from "@/app/list-skeletons";
import { OwnerBookSlots } from "@/app/owner/book-slots";
import { OwnerRest } from "@/app/owner/rest";
import { civilFromYyyyMmDd } from "@/app/owner/shared";
import { OwnerToday } from "@/app/owner/today";
import { submitLogout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { FlashToast } from "@/components/ui/flash-toast";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ui } from "@/lib/ui-copy";

const TIME_ZONE = "Asia/Beirut";

function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readPeriodQuery(params: {
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

function ownerKeepSearch(
  tenantSlug: string,
  bookOn: string,
  period: LedgerPeriodQuery,
): string {
  const next = new URLSearchParams();
  next.set("tenant", tenantSlug);
  next.set("bookOn", bookOn);
  if (period.from) next.set("from", period.from);
  if (period.to) next.set("to", period.to);
  if (period.view !== "usd") next.set("view", period.view);
  if (period.displayRate) next.set("displayRate", period.displayRate);
  return next.toString();
}

/**
 * Thin locked page. No Prisma and no tenantId.
 * Next 16: searchParams is a Promise (page.js docs). Period form is GET, not a Server Action.
 * Lists stream in children so header + Book day stay mounted (no route loading.tsx).
 */
export default async function OwnerPage({ searchParams }: PageProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug =
    typeof params.tenant === "string" && params.tenant.length > 0
      ? params.tenant
      : tenant.slug;
  const membership = await getCurrentMembership();

  if (!membership) {
    const next = new URLSearchParams();
    next.set("tenant", tenantSlug);
    redirect(`/login?${next.toString()}`);
  }

  const mayCreateBooking = can(membership, BOOKINGS_CREATE);
  const errorKey = queryString(params.error);
  const ok = queryString(params.ok);
  const today = todayInTimeZone(TIME_ZONE);
  const bookOn = parseOwnerBookOn(queryString(params.bookOn)) ?? today;
  const periodQuery = readPeriodQuery({
    from: params.from,
    to: params.to,
    view: params.view,
    displayRate: params.displayRate,
  });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-8">
      <FlashToast
        ok={ok}
        error={errorKey}
        keepQuery={ownerKeepSearch(tenantSlug, bookOn, periodQuery)}
      />
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">
            <LtrIsolate>{membership.identifier}</LtrIsolate>
            {" · "}
            {ui(`role.${membership.role}`)}
          </p>
        </div>
        <form action={submitLogout}>
          <input type="hidden" name="tenant" value={tenantSlug} />
          <SubmitButton variant="outline">{ui("owner.logout")}</SubmitButton>
        </form>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl">{ui("owner.today")}</h2>
        <Suspense fallback={<TodayListsSkeleton />}>
          <OwnerToday
            membership={membership}
            tenantSlug={tenantSlug}
            bookOn={bookOn}
            periodQuery={periodQuery}
          />
        </Suspense>
      </section>

      {mayCreateBooking ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg">{ui("owner.bookHeading")}</h2>
          <form method="get" action="/owner" className="flex flex-col gap-3">
            <input type="hidden" name="tenant" value={tenantSlug} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="bookOn">{ui("public.day")}</Label>
              <DateField
                id="bookOn"
                name="bookOn"
                required
                defaultValue={bookOn}
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              {ui("owner.showSlots")}
            </Button>
          </form>
          <Suspense key={bookOn} fallback={<BookSlotsSkeleton />}>
            <OwnerBookSlots
              tenantSlug={tenantSlug}
              bookOn={bookOn}
              periodQuery={periodQuery}
            />
          </Suspense>
        </section>
      ) : null}

      <Suspense fallback={<OwnerRestSkeleton />}>
        <OwnerRest
          membership={membership}
          tenantSlug={tenantSlug}
          bookOn={bookOn}
          periodQuery={periodQuery}
          today={today}
        />
      </Suspense>
    </main>
  );
}

function todayInTimeZone(timeZone: string): string {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function parseOwnerBookOn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    civilFromYyyyMmDd(value);
    return value;
  } catch {
    return undefined;
  }
}
