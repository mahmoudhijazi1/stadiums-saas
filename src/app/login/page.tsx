import { getCurrentTenant } from "@/lib/tenant-context";
import { submitLogin } from "@/app/login/actions";

/**
 * Thin login route. No Prisma and no tenantId.
 * Hidden tenant slug only keeps local ?tenant= after redirect.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const failed = params.error === "1";

  return (
    <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1>Log in — {tenant.name}</h1>
      <p>
        Tenant: <code>{tenant.slug}</code>
      </p>
      {failed ? <p>Invalid login</p> : null}
      <form action={submitLogin}>
        <input type="hidden" name="tenant" value={tenant.slug} />
        <p>
          <label>
            Identifier{" "}
            <input
              type="text"
              name="identifier"
              required
              autoComplete="username"
              placeholder="owner@ahmad"
            />
          </label>
        </p>
        <p>
          <label>
            Password{" "}
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
        </p>
        <p>
          <button type="submit">Log in</button>
        </p>
      </form>
    </main>
  );
}
