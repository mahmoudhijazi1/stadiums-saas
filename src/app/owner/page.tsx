import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { submitLogout } from "@/app/login/actions";

/**
 * Thin locked page. No Prisma and no tenantId. No approve list (SPEC-04).
 */
export default async function OwnerPage({ searchParams }: PageProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const tenantSlug =
    typeof params.tenant === "string" && params.tenant.length > 0
      ? params.tenant
      : tenant.slug;
  const membership = await getCurrentMembership();

  if (!membership) {
    const next = new URLSearchParams();
    next.set("tenant", tenantSlug);
    redirect(`/login?${next.toString()}`);
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>{tenant.name}</h1>
      <p>
        Signed in as <code>{membership.identifier}</code> ({membership.role})
      </p>
      <form action={submitLogout}>
        <input type="hidden" name="tenant" value={tenantSlug} />
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
