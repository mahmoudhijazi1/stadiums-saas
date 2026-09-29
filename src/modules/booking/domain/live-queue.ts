export type LiveQueueSnapshot = {
  pendingCount: number;
  /** ISO time of the newest actionable request, or null when the queue is empty. */
  latestRequestedAt: string | null;
};

/** True when the owner should refresh the badge, the banner, and the list. */
export function liveQueueChanged(
  previous: LiveQueueSnapshot,
  next: LiveQueueSnapshot,
): boolean {
  return (
    previous.pendingCount !== next.pendingCount ||
    previous.latestRequestedAt !== next.latestRequestedAt
  );
}

export const MAX_RECONCILE_REFRESHES = 2;

export type ReconcileAction = "accept" | "retry" | "give-up";

/**
 * Decide what to do when a poll-triggered refresh has rendered.
 * accept: the render matches what the poll saw.
 * retry: the render is behind the poll, so refresh once more.
 * give-up: still behind after the retry budget, so trust the server render.
 */
export function reconcileAfterRefresh(
  rendered: LiveQueueSnapshot,
  known: LiveQueueSnapshot,
  attemptsUsed: number,
  maxAttempts = MAX_RECONCILE_REFRESHES,
): ReconcileAction {
  if (!liveQueueChanged(rendered, known)) return "accept";
  return attemptsUsed < maxAttempts ? "retry" : "give-up";
}

export const LIVE_POLL_MS = 20_000;
export const LIVE_BACKOFF_MS = 60_000;

/** 20s while healthy. 60s after two failures in a row. A success returns to 20s. */
export function nextPollDelayMs(consecutiveFailures: number): number {
  return consecutiveFailures >= 2 ? LIVE_BACKOFF_MS : LIVE_POLL_MS;
}

export function latestRequestedAtIso(
  rows: { requestedAt: Date }[],
): string | null {
  let max: number | null = null;
  for (const row of rows) {
    const time = row.requestedAt.getTime();
    if (max === null || time > max) max = time;
  }
  return max === null ? null : new Date(max).toISOString();
}
