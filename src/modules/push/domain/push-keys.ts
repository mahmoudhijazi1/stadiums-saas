/**
 * The two secrets a browser hands over with a subscription, both base64url without padding:
 * p256dh is the 65-byte uncompressed P-256 public key (87 characters), auth is 16 bytes (22).
 */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export const P256DH_LENGTH = 87;
export const AUTH_LENGTH = 22;

export type PushKeys = { p256dh: string; auth: string };

export function validatePushKeys(keys: unknown): PushKeys | null {
  if (!keys || typeof keys !== "object") return null;
  const { p256dh, auth } = keys as Record<string, unknown>;
  if (typeof p256dh !== "string" || p256dh.length !== P256DH_LENGTH || !BASE64URL.test(p256dh)) return null;
  if (typeof auth !== "string" || auth.length !== AUTH_LENGTH || !BASE64URL.test(auth)) return null;
  return { p256dh, auth };
}
