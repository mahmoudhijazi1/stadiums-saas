import pg from "pg";

/**
 * One integration run at a time on stadiums_test. Two runs on the same database truncate each other's
 * rows mid-test (foreign-key and unique-slug failures in `seedMinimalFixture`), so a run takes a
 * session-level advisory lock on its own connection, holds it until the end, and a second run fails at
 * once. The lock dies with the connection, so a killed run never leaves it behind.
 */
export const RUN_LOCK_KEY = 72_610_401;
export const RUN_LOCK_TAKEN_MESSAGE = "Another integration run is using stadiums_test. Wait for it to finish.";

export async function acquireRunLock(connectionString: string, key: number = RUN_LOCK_KEY): Promise<pg.Client> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [key]);
    if (!result.rows[0]?.locked) throw new Error(RUN_LOCK_TAKEN_MESSAGE);
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  return client;
}

export async function releaseRunLock(client: pg.Client, key: number = RUN_LOCK_KEY): Promise<void> {
  try {
    await client.query("SELECT pg_advisory_unlock($1)", [key]);
  } finally {
    await client.end();
  }
}
