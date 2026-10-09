/**
 * VAPID identity from the environment (validated at startup, src/lib/env.ts). Null when any of
 * the three is missing: the feature is then "not configured" (dev) and the UI hides itself.
 * The private key lives only in this object; nothing returns or logs it.
 */
export type PushConfig = { publicKey: string; privateKey: string; subject: string };

export function readPushConfig(env: Record<string, string | undefined> = process.env): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
