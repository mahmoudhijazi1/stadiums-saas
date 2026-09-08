import { headers } from "next/headers";
import db from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant-context";

/**
 * Hand-check for SPEC-01 step 4:
 * findMany on pitches with NO tenantId in this file — extension must inject it.
 * (Step 5 will move this query into modules/venue/infrastructure.)
 */
export default async function Home() {
  const host = (await headers()).get("host") ?? "(missing)";
  const tenant = await getCurrentTenant();

  // IMPORTANT: no tenantId here on purpose
  const pitches = await db.pitch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>Tenant DB scope check (Step 4)</h1>
      <p>
        <strong>Host:</strong> <code>{host}</code>
      </p>
      <p>
        Tenant: <code>{tenant.slug}</code> — {tenant.name}
      </p>
      <h2>Pitches (auto-scoped)</h2>
      {pitches.length === 0 ? (
        <p>
          No pitches for this tenant yet. Add some in Prisma Studio with this tenant&apos;s{" "}
          <code>tenantId</code>.
        </p>
      ) : (
        <ul>
          {pitches.map((pitch) => (
            <li key={pitch.id}>{pitch.name}</li>
          ))}
        </ul>
      )}
      <hr />
      <p>
        <strong>Hand check:</strong> create two tenants (e.g. ahmad, sami), each with different
        pitch names. Open each tenant URL — you must only see that tenant&apos;s pitches.
      </p>
      <ol>
        <li>
          <code>http://localhost:3000/?tenant=ahmad</code>
        </li>
        <li>
          <code>http://localhost:3000/?tenant=sami</code>
        </li>
      </ol>
    </main>
  );
}
