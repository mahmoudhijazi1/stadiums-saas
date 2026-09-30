/**
 * The seed deletes every table and recreates users with LOCAL_DEV_PASSWORD
 * (security audit S-1). It may run only outside production and only against
 * the local dev or test database named in .env.example.
 */
export const SEEDABLE_DATABASES = ["stadiums_dev", "stadiums_test"] as const;

export function assertSeedAllowed(input: {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
}): void {
  if (input.nodeEnv === "production") {
    throw new Error("Seed refused: NODE_ENV is production.");
  }
  const name = databaseName(input.databaseUrl);
  if (!name || !(SEEDABLE_DATABASES as readonly string[]).includes(name)) {
    throw new Error(
      `Seed refused: database "${name ?? "?"}" is not one of ${SEEDABLE_DATABASES.join(", ")}.`,
    );
  }
}

function databaseName(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  try {
    const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
    return name || null;
  } catch {
    return null;
  }
}
