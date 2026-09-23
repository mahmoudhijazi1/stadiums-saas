import { Suspense } from "react";
import {
  queryString,
  requireOwnerMembership,
} from "@/app/owner/shared";
import { OwnerToday } from "./lists";
import { TodayListsSkeleton } from "./skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";

export default async function OwnerTodayPage({
  searchParams,
}: PageProps<"/owner/today">) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const highlight = queryString(
    (params as { highlight?: string | string[] }).highlight,
  );

  return (
    <section className="flex flex-col gap-4">
      <Suspense fallback={<TodayListsSkeleton />}>
        <OwnerToday
          membership={membership}
          locale={locale}
          highlight={highlight}
        />
      </Suspense>
    </section>
  );
}
