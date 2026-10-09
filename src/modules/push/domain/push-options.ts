import type { PushKind } from "@/modules/push/domain/push-payload";

export type PushSendOptions = {
  /** How long the push service keeps the message if the phone is off. */
  ttlSeconds: number;
  urgency: "very-low" | "low" | "normal" | "high";
  /** A newer message with the same topic replaces one still waiting at the push service. */
  topic: string;
};

/**
 * TEST is only useful right now: a minute, then drop it. NEW_REQUEST stays useful for six hours:
 * a phone can be off or out of signal for hours, and a request is still there to answer until
 * its slot starts. A newer one replaces it by topic.
 * Topic is base64url-safe, 32 characters at most.
 */
export function pushSendOptions(kind: PushKind, tag: string): PushSendOptions {
  const topic = tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  switch (kind) {
    case "TEST":
      return { ttlSeconds: 60, urgency: "high", topic };
    case "NEW_REQUEST":
      return { ttlSeconds: 21600, urgency: "high", topic };
  }
}
