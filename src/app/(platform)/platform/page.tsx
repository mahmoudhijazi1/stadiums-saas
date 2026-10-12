import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { ui } from "@/lib/copy";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { listTenants } from "@/modules/platform/application/list-tenants";
import { getCurrentPlatformAdmin } from "@/modules/platform/application/platform-session";
import { orderTenantsForAdmin } from "@/modules/platform/domain/tenant-order";
import { submitPlatformLogout } from "@/app/(platform)/platform/actions";
import { PlatformFrame } from "@/app/(platform)/platform/_components/platform-frame";
import { StadiumCard } from "@/app/(platform)/platform/_components/stadium-card";

/**
 * The platform admin home (DR-006): every stadium as a card, suspended first, then overdue, then
 * the rest by name. Read only. Same data as the CLI `tenants list`. Dynamic: it reads the session
 * cookie. Resolves no tenant.
 */
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  await requirePlatformHost();
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/platform/login");

  const stadiums = orderTenantsForAdmin(await listTenants());

  return (
    <PlatformFrame identifier={admin.identifier} logout={submitPlatformLogout}>
      <h1 className="text-2xl font-semibold">{ui("platform.stadiums", "en")}</h1>
      {stadiums.length === 0 ? (
        <EmptyState title={ui("platform.emptyTitle", "en")} next={ui("platform.emptyNext", "en")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {stadiums.map((stadium) => (
            <li key={stadium.slug}>
              <StadiumCard
                stadium={{
                  slug: stadium.slug,
                  name: stadium.name,
                  status: stadium.status,
                  overdue: stadium.overdue,
                  plan: stadium.plan,
                  paidUntil: stadium.paidUntil ? stadium.paidUntil.toISOString().slice(0, 10) : null,
                  pitchCount: stadium.pitchCount,
                  bookingsLast30Days: stadium.bookingsLast30Days,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </PlatformFrame>
  );
}
