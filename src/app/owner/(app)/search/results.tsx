import Link from "next/link";
import { searchPeople } from "@/modules/people/application/search-people";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

export async function SearchResults({
  locale,
  query,
}: {
  locale: UiLocale;
  query: string;
}) {
  if (!query.trim()) {
    return (
      <p className="text-sm text-muted-foreground">{ui("owner.searchHint", locale)}</p>
    );
  }

  const hits = await searchPeople(query);
  if (hits.length === 0) {
    return (
      <EmptyState
        title={ui("owner.searchEmpty", locale)}
        next={ui("owner.searchEmptyNext", locale)}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {hits.map((hit) => (
        <li key={hit.id}>
          <Link
            href={`/owner/people/${hit.id}`}
            className="flex min-h-11 flex-col justify-center rounded-[var(--radius-control)] px-1 outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="text-sm font-medium">{hit.name}</span>
            {hit.phone ? (
              <LtrIsolate className="text-sm text-muted-foreground">
                {hit.phone}
              </LtrIsolate>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
