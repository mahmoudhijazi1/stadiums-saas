import type { PushKind } from "@/modules/push/domain/push-payload";

export type PushSendOptions = {
  /** How long the push service keeps the message if the phone is off. */
  ttlSeconds: number;
  urgency: "very-low" | "low" | "normal" | "high";
  /** A newer message with the same topic replaces one still waiting at the push service. */
  topic: string;
};

/** A test is only useful right now: a minute, then drop it. Topic is base64url-safe, 32 chars max. */
export function pushSendOptions(kind: PushKind, tag: string): PushSendOptions {
  const topic = tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  switch (kind) {
    case "TEST":
      return { ttlSeconds: 60, urgency: "high", topic };
  }
}
