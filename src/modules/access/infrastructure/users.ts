import { platformDb } from "@/lib/platform-db";

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
