/**
 * Login brute-force limits (security audit S-3).
 * Per account: 8 failures in 15 minutes → blocked for 15 minutes.
 * Per IP (only with TRUSTED_CLIENT_IP_HEADER): 40 failures in 15 minutes →
 * blocked for 15 minutes. Counted for unknown accounts too (no enumeration).
 */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_ACCOUNT = 8;
export const LOGIN_MAX_FAILURES_PER_IP = 40;

export function loginLimitKeys(identifier: string, ip: string | null) {
  return {
    account: { failures: `login:fail:acct:${identifier}`, block: `login:block:acct:${identifier}` },
    ip: ip ? { failures: `login:fail:ip:${ip}`, block: `login:block:ip:${ip}` } : null,
  };
}
