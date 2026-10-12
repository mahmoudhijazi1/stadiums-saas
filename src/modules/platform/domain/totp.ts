import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords, RFC 4226 (HOTP) and RFC 6238 (TOTP): HMAC-SHA1, 30-second step,
 * 6 digits. Pure: no randomness and no clock here (the caller passes the secret and the step).
 * Used by the platform admin login (DR-006).
 */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted on either side of the current one. */
export const TOTP_WINDOW = 1;

/** HOTP: the `digits`-digit code for a secret and a counter. */
export function hotp(secret: Uint8Array, counter: number | bigint, digits: number = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The 30-second step a Unix time (seconds) falls in. */
export function stepAt(unixSeconds: number): number {
  return Math.floor(unixSeconds / TOTP_STEP_SECONDS);
}

/** TOTP: the code for a step. */
export function totpCode(secret: Uint8Array, step: number, digits: number = TOTP_DIGITS): string {
  return hotp(secret, step, digits);
}

function sameCode(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * The step whose code matches (the current step or one either side), or null. All three steps are
 * always computed and compared in constant time, so the answer does not leak which one matched.
 * Whether that step was already used is the caller's job (`lastTotpStep`).
 */
export function verifyTotp(secret: Uint8Array, code: string, nowStep: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  let matched: number | null = null;
  for (let step = nowStep - TOTP_WINDOW; step <= nowStep + TOTP_WINDOW; step += 1) {
    if (sameCode(totpCode(secret, step), code) && (matched === null || step > matched)) matched = step;
  }
  return matched;
}

/** The otpauth:// URI an authenticator app enrolls from (issuer "lebstads" unless given). */
export function otpauthUri(input: { secretBase32: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? "lebstads";
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(input.account)}`;
  const query = new URLSearchParams({
    secret: input.secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
