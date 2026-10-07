import { platformDb } from "@/lib/platform-db";
import { hashSessionToken } from "@/modules/access/infrastructure/session-token";

/**
 * User has no tenantId — lookup by identifier must not go through `db` (DR-003 §3).
 */
export async function findUserByIdentifier(identifier: string) {
  return platformDb.user.findUnique({
    where: { identifier },
    select: { id: true, identifier: true, passwordHash: true },
  });
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  await platformDb.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function findUserById(id: string) {
  return platformDb.user.findUnique({
    where: { id },
    select: { id: true, identifier: true, passwordHash: true },
  });
}

/**
 * New password hash and every OTHER session of the user gone, in one transaction. The
 * current session (matched by the hash of its cookie token) stays. Not a tenant
 * transaction: User and Session are global.
 */
export async function replacePasswordKeepingSession(
  userId: string,
  passwordHash: string,
  currentToken: string,
) {
  await platformDb.$transaction([
    platformDb.user.update({ where: { id: userId }, data: { passwordHash } }),
    platformDb.session.deleteMany({
      where: { userId, tokenHash: { not: hashSessionToken(currentToken) } },
    }),
  ]);
}

/**
 * Set a user's login. Runs in a transaction; a taken identifier raises Prisma's unique
 * violation (P2002), which the use case turns into a friendly error. Not a tenant
 * transaction: User is global.
 */
export async function updateIdentifier(userId: string, identifier: string) {
  await platformDb.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { identifier } });
  });
}
