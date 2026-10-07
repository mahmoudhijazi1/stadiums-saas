import { platformDb } from "@/lib/platform-db";
import {
  hashSessionToken,
  newSessionToken,
} from "@/modules/access/infrastructure/session-token";

/**
 * Sessions are not tenant-owned. The cookie carries a random token; the row
 * stores only its SHA-256 (security audit S-2), so lookups go by hash.
 */
export async function createSession(userId: string, expiresAt: Date) {
  const token = newSessionToken();
  const row = await platformDb.session.create({
    data: { userId, expiresAt, tokenHash: hashSessionToken(token) },
    select: { userId: true, expiresAt: true },
  });
  return { token, ...row };
}

export async function findSessionByToken(token: string) {
  return platformDb.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
}

export async function deleteSessionByToken(token: string) {
  await platformDb.session
    .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined);
}

/** Rolling renewal. Only moves the expiry forward, so concurrent uses are harmless. */
export async function extendSession(id: string, expiresAt: Date) {
  await platformDb.session.updateMany({
    where: { id, expiresAt: { lt: expiresAt } },
    data: { expiresAt },
  });
}

/** Called on login: a user's dead sessions are removed, live ones kept. */
export async function deleteExpiredSessions(userId: string, now: Date) {
  await platformDb.session.deleteMany({ where: { userId, expiresAt: { lte: now } } });
}

/** Every session of the user except the one with this cookie token. Returns how many. */
export async function deleteOtherSessions(userId: string, currentToken: string): Promise<number> {
  const result = await platformDb.session.deleteMany({
    where: { userId, tokenHash: { not: hashSessionToken(currentToken) } },
  });
  return result.count;
}
