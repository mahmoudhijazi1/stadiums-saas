import { Suspense } from "react";
import { OwnerBackLink } from "@/app/owner/back-link";
import { queryString, requireOwnerMembership } from "@/app/owner/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { SearchField } from "./search-field";
import { SearchResults } from "./results";

/**
 * Header search. Local pitch page: searchParams is a Promise.
 * Logged-in membership may look, same as the day list.
 */
export default async function OwnerSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwnerMembership();
  const locale = await getUiLocale();
  const query = queryString((await searchParams).q) ?? "";

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/today" locale={locale} />
      <SearchField locale={locale} query={query} />
      <Suspense fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
        <SearchResults locale={locale} query={query} />
      </Suspense>
    </section>
  );
}
