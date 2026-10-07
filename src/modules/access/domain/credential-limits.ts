/**
 * Limits for changing your own credentials (password, login). Counted per user and
 * separate from the login counter: failed attempts here never lock login, and a
 * success resets this counter. 5 failures in 15 minutes block for 15 minutes.
 */
export const PWCHANGE_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const PWCHANGE_BLOCK_MS = 15 * 60 * 1000;
export const PWCHANGE_MAX_FAILURES = 5;

export function pwChangeKeys(userId: string) {
  return { failures: `pwchange:${userId}`, block: `pwchange:block:${userId}` };
}
