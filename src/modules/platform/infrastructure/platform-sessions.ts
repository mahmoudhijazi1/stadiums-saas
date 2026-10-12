import { hashSessionToken, newSessionToken } from "@/modules/access/infrastructure/session-token";
import type { PlatformTx } from "@/modules/platform/infrastructure/platform-store";

/**
 * PlatformSession rows (DR-006), like owner sessions: the cookie carries 256 random bits, the row
 * stores only their SHA-256. Global table; callers pass the platform client or a `PlatformTx`.
 */
export type SessionWithAdmin = {
  id: string;
  adminId: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  admin: { identifier: string };
};

export async function createPlatformSession(
  tx: PlatformTx,
  adminId: string,
  expiresAt: Date,
): Promise<{ token: string }> {
  const token = newSessionToken();
  await tx.platformSession.create({ data: { adminId, expiresAt, tokenHash: hashSessionToken(token) } });
  return { token };
}

export async function findPlatformSessionByTokenHash(tx: PlatformTx, tokenHash: string): Promise<SessionWithAdmin | null> {
  return tx.platformSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      adminId: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      admin: { select: { identifier: true } },
    },
  });
}

export async function touchPlatformSession(tx: PlatformTx, id: string, now: Date): Promise<void> {
  await tx.platformSession.updateMany({ where: { id }, data: { lastSeenAt: now } });
}

export async function deletePlatformSession(tx: PlatformTx, id: string): Promise<void> {
  await tx.platformSession.deleteMany({ where: { id } });
}

export async function deletePlatformSessionByTokenHash(tx: PlatformTx, tokenHash: string): Promise<number> {
  const result = await tx.platformSession.deleteMany({ where: { tokenHash } });
  return result.count;
}

/** A login also clears this admin's dead sessions. */
export async function deleteExpiredPlatformSessions(tx: PlatformTx, adminId: string, now: Date): Promise<void> {
  await tx.platformSession.deleteMany({ where: { adminId, expiresAt: { lte: now } } });
}
