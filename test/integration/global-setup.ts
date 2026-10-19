import { config } from "dotenv";
import type pg from "pg";
import { acquireRunLock } from "./run-lock";

/**
 * Runs once, before any integration file: takes the run lock (see run-lock.ts) on a connection that
 * stays open until global-teardown.ts releases it. Jest shares globalThis between the two.
 */
export default async function globalSetup(): Promise<void> {
  config({ quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url?.includes("/stadiums_test")) {
    throw new Error("Integration tests require DATABASE_URL_TEST pointing at database stadiums_test.");
  }
  (globalThis as { integrationRunLock?: pg.Client }).integrationRunLock = await acquireRunLock(url);
}
