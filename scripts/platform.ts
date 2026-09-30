import "dotenv/config";
import { hostname, userInfo } from "node:os";
import { endPrismaPool } from "@/lib/prisma-base";
import { isInteractive, terminalIo } from "./lib/operator-io";
import { runPlatformCommand } from "./platform-cli";

/**
 * Platform operator CLI. Access = SSH + DATABASE_URL (decision 1).
 *   npx tsx scripts/platform.ts tenants list
 * Full usage: docs/RUNBOOK.md, "Tenant management".
 */
runPlatformCommand(process.argv.slice(2), {
  io: terminalIo(),
  interactive: isInteractive(),
  databaseUrl: process.env.DATABASE_URL,
  actor: `cli:${userInfo().username}@${hostname()}`,
})
  .then(() => endPrismaPool())
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    await endPrismaPool().catch(() => undefined);
    process.exitCode = 1;
  });
