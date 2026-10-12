import type { PlatformTx } from "@/modules/platform/infrastructure/platform-store";

/**
 * PlatformAdmin and PlatformSession rows (DR-006). Global tables, so these use the platform client
 * through a `PlatformTx` the use case opened (`platformTransaction`). Nothing here reads a password,
 * a secret in the clear, or a session token.
 */
export type AdminRow = {
  id: string;
  identifier: string;
  passwordHash: string;
  totpSecretEnc: string | null;
  lastTotpStep: bigint | null;
  createdAt: Date;
};

export async function createAdmin(
  tx: PlatformTx,
  input: { identifier: string; passwordHash: string },
): Promise<{ id: string }> {
  return tx.platformAdmin.create({ data: input, select: { id: true } });
}

/** `identifier` must already be lowercase (the table has a CHECK). */
export async function findAdminByIdentifier(tx: PlatformTx, identifier: string): Promise<AdminRow | null> {
  return tx.platformAdmin.findUnique({ where: { identifier } });
}

export async function listAdmins(
  tx: PlatformTx,
): Promise<{ identifier: string; enrolled: boolean; createdAt: Date }[]> {
  const rows = await tx.platformAdmin.findMany({
    orderBy: { identifier: "asc" },
    select: { identifier: true, totpSecretEnc: true, createdAt: true },
  });
  return rows.map((row) => ({ identifier: row.identifier, enrolled: row.totpSecretEnc !== null, createdAt: row.createdAt }));
}

/** Save an encrypted secret and the step of the code that proved it (so that code cannot be replayed). */
export async function setTotpSecret(tx: PlatformTx, adminId: string, encrypted: string, step: number): Promise<void> {
  await tx.platformAdmin.update({
    where: { id: adminId },
    data: { totpSecretEnc: encrypted, lastTotpStep: BigInt(step) },
  });
}

/** Back to "not enrolled": login is refused until the admin enrolls again. */
export async function clearTotp(tx: PlatformTx, adminId: string): Promise<void> {
  await tx.platformAdmin.update({ where: { id: adminId }, data: { totpSecretEnc: null, lastTotpStep: null } });
}

export async function setPassword(tx: PlatformTx, adminId: string, passwordHash: string): Promise<void> {
  await tx.platformAdmin.update({ where: { id: adminId }, data: { passwordHash } });
}

export async function deleteSessionsForAdmin(tx: PlatformTx, adminId: string): Promise<number> {
  const result = await tx.platformSession.deleteMany({ where: { adminId } });
  return result.count;
}

/**
 * Accept a TOTP step once. ONE atomic UPDATE: it changes the row only while the stored step is
 * absent or earlier, so of two concurrent logins with the same code exactly one gets `true`.
 */
export async function consumeTotpStep(tx: PlatformTx, adminId: string, step: number): Promise<boolean> {
  const changed = await tx.$executeRaw`
    UPDATE "PlatformAdmin" SET "lastTotpStep" = ${BigInt(step)}
    WHERE "id" = ${adminId} AND ("lastTotpStep" IS NULL OR "lastTotpStep" < ${BigInt(step)})`;
  return changed === 1;
}
