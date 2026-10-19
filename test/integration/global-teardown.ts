import type pg from "pg";
import { releaseRunLock } from "./run-lock";

/** Runs once, after every integration file: releases the run lock taken in global-setup.ts. */
export default async function globalTeardown(): Promise<void> {
  const holder = globalThis as { integrationRunLock?: pg.Client };
  const client = holder.integrationRunLock;
  holder.integrationRunLock = undefined;
  if (client) await releaseRunLock(client);
}
