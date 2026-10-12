import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { encodeBase32 } from "@/modules/platform/domain/base32";

/**
 * The platform admins' TOTP secrets at rest (DR-006): AES-256-GCM under PLATFORM_TOTP_KEY (32
 * random bytes, base64). A stored value is `v1.<iv>.<tag>.<ciphertext>` in base64url. The row id
 * is bound as additional authenticated data, so a ciphertext copied to another admin fails.
 * Nothing here logs or returns the key.
 */
const VERSION = "v1";
const IV_BYTES = 12;

/** The key from the environment. Throws (naming the variable, never its value) when it is missing or not 32 bytes. */
export function loadTotpKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.PLATFORM_TOTP_KEY;
  if (!raw) throw new Error("PLATFORM_TOTP_KEY is not set (openssl rand -base64 32).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PLATFORM_TOTP_KEY must decode to exactly 32 bytes (openssl rand -base64 32).");
  return key;
}

/** A new TOTP secret: 20 random bytes (the RFC 4226 recommendation), as base32. */
export function newTotpSecretBase32(): string {
  return encodeBase32(randomBytes(20));
}

export function encryptTotpSecret(plain: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** The plain secret, or throws when the value is malformed, tampered with, from another row or under another key. */
export function decryptTotpSecret(stored: string, key: Buffer, aad: string): string {
  const [version, iv, tag, body] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Stored TOTP secret is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
