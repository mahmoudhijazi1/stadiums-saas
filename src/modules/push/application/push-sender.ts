import type { PushSender } from "@/modules/push/domain/push-sender";
import { webPushSender } from "@/modules/push/infrastructure/web-push-sender";

export type { PushResult, PushSendOptions, PushSender, PushTarget } from "@/modules/push/domain/push-sender";

let override: PushSender | null = null;

/** Tests only: replace the sender. Pass null to restore the real one. */
export function setPushSender(sender: PushSender | null): void {
  override = sender;
}

export function getPushSender(): PushSender {
  return override ?? webPushSender;
}
