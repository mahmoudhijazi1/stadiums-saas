import { getCurrentTenant } from "@/lib/tenant-context";
import { listPitches } from "@/modules/venue/infrastructure/pitches";

/**
 * Thin route (SPEC-01 step 5):
 * - resolve tenant (404 if unknown)
 * - ask venue infrastructure for pitches
 * - render
 * No Prisma and no tenantId in this file.
 */
export default async function HomePage() {
  const tenant = await getCurrentTenant();
  const pitches = await listPitches();

  return (
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>{tenant.name}</h1>
      <p>
        Tenant: <code>{tenant.slug}</code>
      </p>
      <h2>Pitches</h2>
      {pitches.length === 0 ? (
        <p>No pitches yet.</p>
      ) : (
        <ul>
          {pitches.map((pitch) => (
            <li key={pitch.id}>{pitch.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
