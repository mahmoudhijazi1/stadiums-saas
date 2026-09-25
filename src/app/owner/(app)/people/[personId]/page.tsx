import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OwnerBackLink } from "@/app/owner/back-link";
import { queryString, requireOwnerMembership } from "@/app/owner/shared";
import { getPerson } from "@/modules/people/application/get-person";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { Skeleton } from "@/components/ui/skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { PersonGames } from "./games";
import { PersonStats } from "./stats";

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
  await requireOwnerMembership();
  const { personId } = await params;
  const query = await searchParams;
  const locale = await getUiLocale();
  const person = await getPerson(personId);
  if (!person) notFound();

  const before = queryString(query.before);
  const beforeId = queryString(query.beforeId);
  const cursor = readCursor(before, beforeId);

  return (
    <section className="flex flex-col gap-6">
      <OwnerBackLink href="/owner/today" locale={locale} />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl leading-none font-extrabold">{person.name}</h1>
        {person.phone ? (
          <LtrIsolate className="text-sm text-muted-foreground">{person.phone}</LtrIsolate>
        ) : null}
      </header>
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <PersonStats
          personId={person.id}
          personName={person.name}
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
