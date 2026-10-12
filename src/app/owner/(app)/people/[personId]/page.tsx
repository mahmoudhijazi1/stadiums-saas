import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OwnerBackLink } from "@/components/shell/back-link";
import { queryString } from "@/lib/search-params";
import { requireOwnerMembership } from "@/app/owner/require-owner";
import { PEOPLE_EDIT, can } from "@/modules/access/domain/can";
import { submitUpdatePerson } from "@/app/owner/(app)/people/[personId]/actions";
import { PersonEditSheet } from "@/app/owner/(app)/people/[personId]/_components/person-edit-sheet";
import { getPerson } from "@/modules/people/application/get-person";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Skeleton } from "@/components/ui/skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/copy";
import { weeklyWeekdayAndTime } from "@/modules/booking/ui/series-labels";
import { listWeeklyBookings } from "@/modules/booking/application/list-weekly-bookings";
import { PersonGames } from "@/app/owner/(app)/people/[personId]/_components/games";
import { PersonStats } from "@/app/owner/(app)/people/[personId]/_components/stats";

/**
 * Person history. Local pitch page: params and searchParams are Promises.
 * 404 when the id is missing on this tenant. Stats and games stream apart.
 */
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireOwnerMembership();
  const { personId } = await params;
  const query = await searchParams;
  const locale = await getUiLocale();
  const person = await getPerson(personId);
  if (!person) notFound();

  // "Weekly every Tue 8:00 PM" for each weekly booking this person still has games in.
  const tenant = await getCurrentTenant();
  const weekly = (await listWeeklyBookings({ personId })).map((row) => {
    const when = weeklyWeekdayAndTime(row.anchor, locale, tenant.timeDisplay);
    return ui("owner.weeklyPerson", locale).replace("{weekday}", when.weekday).replace("{time}", when.time);
  });

  const before = queryString(query.before);
  const beforeId = queryString(query.beforeId);
  const cursor = readCursor(before, beforeId);

  return (
    <section className="flex flex-col gap-6">
      <OwnerBackLink href="/owner/today" locale={locale} history />
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate font-display text-3xl leading-none font-extrabold"><bdi>{person.name}</bdi></h1>
          {can(membership, PEOPLE_EDIT) ? (
            <PersonEditSheet
              personId={person.id}
              name={person.name}
              phone={person.phone}
              locale={locale}
              action={submitUpdatePerson}
            />
          ) : null}
        </div>
        {person.phone ? (
          <LtrIsolate className="text-sm text-muted-foreground">{person.phone}</LtrIsolate>
        ) : null}
        {weekly.map((line) => (
          <p key={line} className="type-secondary">
            ↻ <LtrIsolate>{line}</LtrIsolate>
          </p>
        ))}
      </header>
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <PersonStats
          personId={person.id}
          phone={person.phone}
          locale={locale}
        />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <PersonGames personId={person.id} locale={locale} cursor={cursor} />
      </Suspense>
    </section>
  );
}

function readCursor(
  before: string | undefined,
  beforeId: string | undefined,
): { start: Date; id: string } | null {
  if (!before || !beforeId) return null;
  const start = new Date(before);
  if (Number.isNaN(start.getTime())) return null;
  return { start, id: beforeId };
}
