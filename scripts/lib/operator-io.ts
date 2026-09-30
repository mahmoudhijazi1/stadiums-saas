import { MIN_PASSWORD_LENGTH } from "@/modules/access/domain/password-policy";
import { databaseNameFromUrl } from "@/prisma/seed-guard";

/**
 * Terminal plumbing shared by the operator scripts (set-password, platform).
 * Prompts go to stderr, results to stdout. Tests pass a scripted OperatorIo.
 */
export type OperatorIo = {
  /** One answer. Hidden answers are never echoed. */
  ask(question: string, options: { hidden: boolean }): Promise<string>;
  /** Prompts and notes (stderr). */
  say(line: string): void;
  /** Results (stdout). */
  print(line: string): void;
};

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

export function requireInteractive(interactive: boolean): void {
  if (!interactive) throw new Error("Refused: run this in an interactive terminal.");
}

/** Show the database name from DATABASE_URL and require typing it exactly. */
export async function confirmDatabase(io: OperatorIo, databaseUrl: string | undefined): Promise<void> {
  const database = databaseNameFromUrl(databaseUrl);
  if (!database) throw new Error("DATABASE_URL is missing or has no database name.");
  io.say(`Database: ${database}`);
  const typed = await io.ask("Type the database name to continue: ", { hidden: false });
  if (typed.trim() !== database) throw new Error("Refused: the database name does not match.");
}

/** Require typing a value back (e.g. the tenant slug before suspend/resume). */
export async function confirmTyped(io: OperatorIo, label: string, expected: string): Promise<void> {
  const typed = await io.ask(`Type the ${label} to continue: `, { hidden: false });
  if (typed.trim() !== expected) throw new Error(`Refused: the ${label} does not match.`);
}

/**
 * New password: hidden prompt twice, at least 12 characters. Never from an
 * argument or an environment variable.
 */
export async function askNewPassword(io: OperatorIo): Promise<string> {
  const password = await io.ask("New password: ", { hidden: true });
  const again = await io.ask("Repeat new password: ", { hidden: true });
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Refused: the password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== again) throw new Error("Refused: the two passwords do not match.");
  return password;
}

/** The real terminal: raw-mode line reader that echoes only visible answers. */
export function terminalIo(): OperatorIo {
  return {
    ask: (question, { hidden }) => readLine(question, !hidden),
    say: (line) => process.stderr.write(`${line}\n`),
    print: (line) => process.stdout.write(`${line}\n`),
  };
}

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
