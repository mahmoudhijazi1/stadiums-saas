import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  requireOwnerMembership,
  tenantSlugFrom,
} from "@/app/owner/shared";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

/**
 * More hub. Destinations live here so the bottom bar stays five tabs.
 * Local Next page.md: searchParams is a Promise. link.md: href object.
 */
export default async function OwnerMorePage({
  searchParams,
}: PageProps<"/owner/more">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug = tenantSlugFrom(params, tenant.slug);
  await requireOwnerMembership(tenantSlug);
  const locale = await getUiLocale();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">{ui("owner.more", locale)}</h2>
      <ul className="flex flex-col gap-2">
        <li>
          <Link
            href={{
              pathname: "/owner/more/settings",
              query: { tenant: tenantSlug },
            }}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {ui("owner.settings", locale)}
            <ChevronRight
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
            />
          </Link>
        </li>
      </ul>
    </section>
  );
}
