import { Suspense } from "react";
import { requireOwnerMembership } from "@/app/owner/shared";
import { PendingRequestList } from "@/app/owner/pending-list";
import { TodayListsSkeleton } from "@/app/owner/(app)/today/skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";

/**
 * Requests tab. Same pending list as Today until the Requests slice
 * adds the notify sheet and reject reasons. No large page title.
 */
export default async function OwnerRequestsPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  return (
    <section className="flex flex-col gap-4">
      <Suspense fallback={<TodayListsSkeleton />}>
        <PendingRequestList membership={membership} locale={locale} />
      </Suspense>
    </section>
  );
}
