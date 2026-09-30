import "dotenv/config";
import { endPrismaPool } from "@/lib/prisma-base";
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
  if (!process.stdin.isTTY) throw new Error("Refused: run this in an interactive terminal.");
  await setPassword(arg, process.env.DATABASE_URL, {
    ask: (question, { hidden }) => (hidden ? askHidden(question) : askVisible(question)),
    say: (line) => process.stderr.write(`${line}\n`),
    print: (line) => process.stdout.write(`${line}\n`),
  });
}

function askVisible(question: string): Promise<string> {
  return readLine(question, true);
}

function askHidden(question: string): Promise<string> {
  return readLine(question, false);
}

/** Read one line in raw mode; echo only when asked (never for passwords). */
function readLine(question: string, echo: boolean): Promise<string> {
  const stdin = process.stdin;
  process.stderr.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return done();
        if (char === "\u0003" || char === "\u0004") return done(new Error("Cancelled."));
        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (echo) process.stderr.write("\b \b");
          }
          continue;
        }
        value += char;
        if (echo) process.stderr.write(char);
      }
    };
    stdin.on("data", onData);
  });
}

main(process.argv.slice(2))
  .then(() => endPrismaPool())
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    await endPrismaPool().catch(() => undefined);
    process.exitCode = 1;
  });
