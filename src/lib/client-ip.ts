import { isIP } from "node:net";
import { headers } from "next/headers";

/**
 * The client IP, only when the operator says which header the reverse proxy
 * sets (env TRUSTED_CLIENT_IP_HEADER, e.g. x-real-ip). Unset → null, so no
 * per-IP limit applies (fail safe: a client-sent header is never trusted).
 * For a list (X-Forwarded-For) the last entry is the one our proxy appended.
 */
export async function trustedClientIp(): Promise<string | null> {
  const name = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
  if (!name) return null;
  const raw = (await headers()).get(name);
  const last = raw?.split(",").at(-1)?.trim();
  return last && isIP(last) ? last : null;
}
