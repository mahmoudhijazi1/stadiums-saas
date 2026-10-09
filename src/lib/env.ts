import { z } from "zod";

/**
 * Environment the server needs (security audit S-18). Checked once at startup
 * (src/instrumentation.ts). Errors name the variable, never its value:
 * DATABASE_URL carries the database password. No session secret: session
 * tokens are random and stored hashed.
 */
const optionalString = (schema: z.ZodString) =>
  z.union([z.literal(""), schema]).optional();

const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "is required" })
    .regex(/^postgres(?:ql)?:\/\/\S+$/, { error: "must be a postgres:// URL" }),
  APP_BASE_DOMAIN: z
    .string({ error: "is required" })
    .regex(/^[a-z0-9.-]+(?::\d+)?$/i, {
      error: "must be a host name, optionally with :port (no scheme or path)",
    }),
  APP_PROTOCOL: z.enum(["http", "https"], { error: "must be http or https" }),
  PASSWORD_HASH_COST: optionalString(
    z.string().regex(/^(1[4-9]|20)$/, { error: "must be an integer from 14 to 20" }),
  ),
  TRUSTED_CLIENT_IP_HEADER: optionalString(
    z.string().regex(/^[a-z0-9-]+$/i, { error: "must be a header name" }),
  ),
  TRUST_PROXY_HEADERS: optionalString(
    z.string().regex(/^(true|false)$/, { error: "must be true or false" }),
  ),
  PG_POOL_MAX: optionalString(z.string().regex(/^[1-9]\d*$/, { error: "must be a positive integer" })),
  // Web push (owner alerts). Required in production, see PRODUCTION_REQUIRED.
  VAPID_PUBLIC_KEY: optionalString(
    z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, { error: "must be a base64url public key" }),
  ),
  VAPID_PRIVATE_KEY: optionalString(
    z.string().regex(/^[A-Za-z0-9_-]{40,50}$/, { error: "must be a base64url private key" }),
  ),
  VAPID_SUBJECT: optionalString(
    z.string().regex(/^(mailto:\S+@\S+|https:\/\/\S+)$/, { error: "must be a mailto: address or an https URL" }),
  ),
});

/** Optional in the schema (local tools and tests run without them), mandatory in production. */
const PRODUCTION_REQUIRED = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

type Env = Record<string, string | undefined>;

/** One line per problem, "NAME must …". Empty when valid. */
export function validateEnv(env: Env): string[] {
  const result = envSchema.safeParse(env);
  // Messages name the variable, never its value (the private key is a secret).
  const problems = result.success
    ? []
    : result.error.issues.map((issue) => `${String(issue.path[0])} ${issue.message}`);
  if (env.NODE_ENV === "production") {
    for (const name of PRODUCTION_REQUIRED) {
      if (!env[name]) problems.push(`${name} is required in production`);
    }
  }
  return problems;
}

/** Fail fast in production; warn elsewhere so local tools keep working. */
export function checkEnvAtStartup(env: Env = process.env): void {
  const errors = validateEnv(env);
  if (errors.length === 0) return;
  const message = `Invalid environment:\n- ${errors.join("\n- ")}`;
  if (env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(message);
}

/**
 * Server start (Node runtime only, from src/instrumentation.ts). A throw in
 * register() only logs "Failed to prepare server" and `next start` keeps
 * running, so a bad production environment exits the process instead.
 */
export function enforceEnvAtStartup(): void {
  try {
    checkEnvAtStartup();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
