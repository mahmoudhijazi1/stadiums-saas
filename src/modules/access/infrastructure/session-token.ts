import { createHash, randomBytes } from "node:crypto";

/**
 * Session tokens (security audit S-2). The cookie carries 32 random bytes
 * (base64url); the database stores only their SHA-256, so a read of the
 * Session table yields no usable cookie. No server secret is needed.
 */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
