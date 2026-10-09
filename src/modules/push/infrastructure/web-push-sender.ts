import webpush from "web-push";
import type { PushResult, PushSender } from "@/modules/push/application/push-sender";
import { readPushConfig } from "@/modules/push/infrastructure/push-config";

/**
 * The only file that imports "web-push" (guarded by test/modules/push/imports.test.ts).
 * Server only: it needs Node's crypto and the private key.
 *
 * Never logs here. The caller logs the endpoint HOST and the outcome. A library error message can
 * echo request details, so only the status code leaves this file.
 */
const REQUEST_TIMEOUT_MS = 10_000;

type WebPushClient = Pick<typeof webpush, "sendNotification">;

/** The client is a parameter so tests can pass a fake instead of the network. */
export function createWebPushSender(client: WebPushClient): PushSender {
  return {
    async send(target, payload, options): Promise<PushResult> {
      const config = readPushConfig();
      if (!config) return { outcome: "retry" };
      try {
        await client.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
          {
            vapidDetails: {
              subject: config.subject,
              publicKey: config.publicKey,
              privateKey: config.privateKey,
            },
            TTL: options.ttlSeconds,
            urgency: options.urgency,
            topic: options.topic,
            timeout: REQUEST_TIMEOUT_MS,
          },
        );
        return { outcome: "ok" };
      } catch (error) {
        // WebPushError carries statusCode; any other failure (network, timeout) has none.
        const code = (error as { statusCode?: unknown } | null)?.statusCode;
        const statusCode = typeof code === "number" ? code : undefined;
        if (statusCode === 404 || statusCode === 410) return { outcome: "gone", statusCode };
        return { outcome: "retry", statusCode };
      }
    },
  };
}

export const webPushSender = createWebPushSender(webpush);
