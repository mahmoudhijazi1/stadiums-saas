import { Suspense } from "react";
import { queryString, requireOwnerMembership } from "@/app/owner/shared";
import { RequestsInbox } from "./inbox";
import { TodayListsSkeleton } from "@/app/owner/(app)/today/skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";

/**
 * Requests tab. Debt warnings and open interests share one owed query.
 * notify= opens the approve or reject WhatsApp list.
 */
export default async function OwnerRequestsPage({
  searchParams,
}: PageProps<"/owner/requests">) {
  const params = await searchParams;
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const notify = queryString(params.notify);

  return (
    <section className="flex flex-col gap-4">
      <Suspense fallback={<TodayListsSkeleton />}>
        <RequestsInbox
          membership={membership}
          locale={locale}
          notify={notify === "approved" || notify === "rejected" ? notify : undefined}
          bookingId={queryString(params.bookingId)}
          reason={queryString(params.reason)}
          siblings={queryString(params.siblings)}
        />
      </Suspense>
    </section>
  );
}
