/**
 * Platform admin login brute-force limits (DR-006): 5 failures in 15 minutes block for 15 minutes,
 * per account, and per IP when TRUSTED_CLIENT_IP_HEADER names the client address. Counted for
 * unknown accounts too (no enumeration). Keys live in the RateLimit table, apart from the owners'.
 */
export const ADMIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_BLOCK_MS = 15 * 60 * 1000;
export const ADMIN_MAX_FAILURES = 5;

export function adminLoginLimitKeys(identifier: string, ip: string | null) {
  return {
    account: { failures: `platform:fail:acct:${identifier}`, block: `platform:block:acct:${identifier}` },
    ip: ip ? { failures: `platform:fail:ip:${ip}`, block: `platform:block:ip:${ip}` } : null,
  };
}
