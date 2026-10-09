import { readPushConfig } from "@/modules/push/infrastructure/push-config";

/**
 * What the browser needs to subscribe: the VAPID PUBLIC key, or null when the server is not
 * configured (the Notifications row then hides). The private key never leaves push-config.
 */
export function getPushPublicKey(): string | null {
  return readPushConfig()?.publicKey ?? null;
}
