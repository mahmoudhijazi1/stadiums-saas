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
 *   logger.error("Approve booking failed", error, { useCase: "approveBooking", tenantId });
 */

const LOG_DIR = path.join(process.cwd(), "logs");

export type LogLevel = "info" | "error";

export type LogContext = {
  useCase?: string;
  tenantId?: string;
};

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

/** Tokens appended to a log line so a stack can be matched to a use case. */
export function formatLogContext(context?: LogContext): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.useCase) parts.push(`useCase=${context.useCase}`);
  if (context.tenantId) parts.push(`tenantId=${context.tenantId}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function write(
  level: LogLevel,
  message: string,
  error?: unknown,
  context?: LogContext,
) {
  ensureLogDir();
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${day}.log`);
  let line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${formatLogContext(context)}`;
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
  info(message: string, error?: unknown, context?: LogContext) {
    write("info", message, error, context);
  },
  error(message: string, error?: unknown, context?: LogContext) {
    write("error", message, error, context);
  },
};
