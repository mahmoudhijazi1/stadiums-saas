import "dotenv/config";
import { endPrismaPool } from "@/lib/prisma-base";
import { isInteractive, requireInteractive, terminalIo } from "./lib/operator-io";
import { listAccounts, setPassword } from "./set-password-core";

/**
 * Usage:
 *   npx tsx scripts/set-password.ts <identifier>
 *   npx tsx scripts/set-password.ts --list
 * The password is only ever typed at the hidden prompt (docs/RUNBOOK.md).
 */
const USAGE = "Usage: tsx scripts/set-password.ts <identifier> | --list";

async function main(argv: string[]): Promise<void> {
  if (argv.length !== 1) throw new Error(USAGE);
  const [arg] = argv as [string];
  if (arg === "--list") {
    await listAccounts((line) => process.stdout.write(`${line}\n`));
    return;
  }
  if (arg.startsWith("-")) throw new Error(USAGE);
  requireInteractive(isInteractive());
  await setPassword(arg, process.env.DATABASE_URL, terminalIo());
}

main(process.argv.slice(2))
  .then(() => endPrismaPool())
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    await endPrismaPool().catch(() => undefined);
    process.exitCode = 1;
  });
