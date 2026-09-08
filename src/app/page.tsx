import { headers } from "next/headers";

/**
 * Temporary hand-check for SPEC-01 step 2:
 * Prove that proxy set x-tenant-slug from the host / ?tenant=.
 * (Later steps will replace this with the real pitches list.)
 */
export default async function Home() {
  const h = await headers();
  const host = h.get("host") ?? "(missing)";
  const tenantSlug = h.get("x-tenant-slug") ?? "(not set)";

  return (
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>Tenant proxy check (Step 2)</h1>
      <p>
        <strong>Host header:</strong> <code>{host}</code>
      </p>
      <p>
        <strong>x-tenant-slug:</strong> <code>{tenantSlug}</code>
      </p>
      <hr />
      <p>Try these in your browser (dev server must be running):</p>
      <ol>
        <li>
          <code>http://localhost:3000</code> → slug should be <code>(not set)</code>
        </li>
        <li>
          <code>http://localhost:3000/?tenant=ahmad</code> → slug should be{" "}
          <code>ahmad</code>
        </li>
        <li>
          <code>http://localhost:3000/?tenant=sami</code> → slug should be{" "}
          <code>sami</code>
        </li>
      </ol>
    </main>
  );
}
