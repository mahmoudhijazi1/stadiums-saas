import { Suspense } from "react";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerWaitlist } from "./list";
import { WaitlistSkeleton } from "./skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

export default async function OwnerWaitlistPage() {
  await requireOwnerMembership();
  const locale = await getUiLocale();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-3xl lg:text-4xl">{ui("owner.waitlist", locale)}</h2>
      <Suspense fallback={<WaitlistSkeleton />}>
        <OwnerWaitlist locale={locale} />
      </Suspense>
    </section>
  );
}
