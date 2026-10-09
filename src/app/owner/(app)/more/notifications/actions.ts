"use server";

import { z } from "zod";
import { actionErrorKey } from "@/lib/use-case-error";
import { sendTestPush, type TestPushResult } from "@/modules/push/application/send-test-push";
import { subscribePush, unsubscribePush } from "@/modules/push/application/subscribe-push";

/**
 * Notification actions for the logged-in user's own devices. The user and session come from the
 * cookie inside each use case; nothing here takes an id from the client. No redirects: the
 * Notifications sheet stays open and shows the result.
 */
export type PushActionResult = { ok: true } | { error: string };
export type TestPushActionResult = { ok: true; result: TestPushResult } | { error: string };

// The limits here are only a cheap first fence; the domain functions are the real check.
const subscribeSchema = z.strictObject({
  endpoint: z.string().max(2048),
  keys: z.strictObject({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  locale: z.string().max(8),
});
const unsubscribeSchema = z.strictObject({ endpoint: z.string().max(2048) });

export async function submitSubscribePush(input: unknown): Promise<PushActionResult> {
  try {
    await subscribePush(subscribeSchema.parse(input));
    return { ok: true };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitSubscribePush") };
  }
}

export async function submitUnsubscribePush(input: unknown): Promise<PushActionResult> {
  try {
    await unsubscribePush(unsubscribeSchema.parse(input));
    return { ok: true };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitUnsubscribePush") };
  }
}

export async function submitSendTestPush(): Promise<TestPushActionResult> {
  try {
    return { ok: true, result: await sendTestPush() };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitSendTestPush") };
  }
}
