import fs from "node:fs";
import path from "node:path";

/**
 * Server-only file logger. Do not import from Client Components (no filesystem).
 * Do not import from `src/proxy.ts` (separate runtime, no Node fs).
 * Do not log secrets (passwords, DATABASE_URL, session cookies).
 *
 * Usage:
 *   logger.info("seed finished");
 *   logger.error("invalid schedule_config", error);
 */

const LOG_DIR = path.join(process.cwd(), "logs");

export type LogLevel = "info" | "error";

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

function write(level: LogLevel, message: string, error?: unknown) {
  ensureLogDir();
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${day}.log`);
  let line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  if (error !== undefined) {
    line += `\n${formatError(error)}`;
  }
  fs.appendFileSync(file, `${line}\n`, "utf8");

  if (level === "error") {
    if (error !== undefined) console.error(message, error);
    else console.error(message);
  } else if (error !== undefined) {
    console.info(message, error);
  } else {
    console.info(message);
  }
}

export const logger = {
  info(message: string, error?: unknown) {
    write("info", message, error);
  },
  error(message: string, error?: unknown) {
    write("error", message, error);
  },
};
