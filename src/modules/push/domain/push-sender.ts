import type { PushSendOptions } from "@/modules/push/domain/push-options";

export type { PushSendOptions };

/** One browser's address and keys, as stored. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/**
 * ok    = the push service accepted it.
 * gone  = 404 / 410: the browser unsubscribed or the subscription expired. Delete the row.
 * retry = anything else (5xx, 429, network). Keep the row.
 */
export type PushResult = { outcome: "ok" | "gone" | "retry"; statusCode?: number };

/** The seam to the push services. Real: web-push. Tests: an in-memory fake. */
export interface PushSender {
  send(target: PushTarget, payload: string, options: PushSendOptions): Promise<PushResult>;
}
