import { cache } from "react";
import { DomainError } from "@/lib/errors";
import { hashSessionToken } from "@/modules/access/infrastructure/session-token";
import { isSessionAlive, shouldTouch } from "@/modules/platform/domain/admin-session";
import {
  deletePlatformSession,
  findPlatformSessionByTokenHash,
  touchPlatformSession,
} from "@/modules/platform/infrastructure/platform-sessions";
import { clearAdminCookie, readAdminCookie, writeAdminCookie } from "@/modules/platform/infrastructure/platform-session-cookie";
import { platformTransaction, writeAudit } from "@/modules/platform/infrastructure/platform-store";

/**
 * Reading and ending the platform admin session (DR-006). No tenant and no owner session is
 * involved; the token comes from the admin cookie only.
 */
export type CurrentPlatformAdmin = { adminId: string; identifier: string };

/**
 * The admin of a raw session token, or null. A dead session (past 8 hours or idle 30 minutes) is
 * deleted on the spot. A live one is marked seen at most once a minute.
 */
export async function resolvePlatformSession(
  token: string | undefined,
  now: Date = new Date(),
): Promise<CurrentPlatformAdmin | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  return platformTransaction(async (tx) => {
    const session = await findPlatformSessionByTokenHash(tx, tokenHash);
    if (!session) return null;
    if (!isSessionAlive(session, now)) {
      await deletePlatformSession(tx, session.id);
      return null;
    }
    if (shouldTouch(session.lastSeenAt, now)) await touchPlatformSession(tx, session.id, now);
    return { adminId: session.adminId, identifier: session.admin.identifier };
  });
}

/** The signed-in admin for this request (cookie, then session), or null. Cached per request. */
export const getCurrentPlatformAdmin = cache(async (): Promise<CurrentPlatformAdmin | null> => {
  return resolvePlatformSession(await readAdminCookie());
});

/**
 * The signed-in admin, or a refusal: every state-changing platform action calls this after the host
 * guard (DR-006). No session is `platform.not_signed_in`, and nothing is read or written after it.
 */
export async function requirePlatformAdmin(): Promise<CurrentPlatformAdmin> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) throw new DomainError("platform.not_signed_in");
  return admin;
}

/** Put the raw token in the admin cookie after a login. From a Server Action only. */
export async function setPlatformSessionCookie(token: string): Promise<void> {
  await writeAdminCookie(token);
}

/**
 * Delete the session behind a raw token and write the `admin.logout` audit row (actor
 * `admin:<id>`) in the same transaction. Returns whether a session existed; nothing is written
 * when there was none.
 */
export async function endPlatformSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashSessionToken(token);
  return platformTransaction(async (tx) => {
    const session = await findPlatformSessionByTokenHash(tx, tokenHash);
    if (!session) return false;
    await deletePlatformSession(tx, session.id);
    await writeAudit(tx, { action: "admin.logout", tenantId: null, actor: `admin:${session.adminId}`, detail: { adminId: session.adminId } });
    return true;
  });
}

/** Log out: delete this browser's session and clear the cookie. From a Server Action only. */
export async function platformLogout(): Promise<void> {
  await endPlatformSession(await readAdminCookie());
  await clearAdminCookie();
}
