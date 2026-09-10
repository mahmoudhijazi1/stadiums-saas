import { platformDb } from "@/lib/platform-db";

/**
 * Sessions are not tenant-owned. Cookie value is Session.id (opaque).
 */
export async function createSession(userId: string, expiresAt: Date) {
  return platformDb.session.create({
    data: { userId, expiresAt },
    select: { id: true, userId: true, expiresAt: true },
  });
}

export async function findSessionById(id: string) {
  return platformDb.session.findUnique({
    where: { id },
    select: { id: true, userId: true, expiresAt: true },
  });
}

export async function deleteSession(id: string) {
  await platformDb.session.delete({ where: { id } }).catch(() => undefined);
}
