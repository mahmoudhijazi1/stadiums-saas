import { DomainError } from "@/lib/errors";
import { checkPassword } from "@/modules/access/domain/password-policy";
import { hashPassword } from "@/modules/access/infrastructure/password";
import { requireActor } from "@/modules/platform/domain/inputs";
import { decodeBase32 } from "@/modules/platform/domain/base32";
import { otpauthUri, stepAt, verifyTotp } from "@/modules/platform/domain/totp";
import {
  clearTotp,
  createAdmin as insertAdmin,
  deleteSessionsForAdmin,
  findAdminByIdentifier,
  listAdmins as readAdmins,
  setPassword,
  setTotpSecret,
} from "@/modules/platform/infrastructure/platform-admins";
import {
  isUniqueViolation,
  platformTransaction,
  writeAudit,
  type PlatformTx,
} from "@/modules/platform/infrastructure/platform-store";
import { encryptTotpSecret, loadTotpKey, newTotpSecretBase32 } from "@/modules/platform/infrastructure/totp-crypto";

/**
 * The platform admins' identity, from the CLI only (DR-006, slice 2): create, enroll the second
 * factor, reset it, set a password, list. Every use case takes an explicit actor and writes a
 * PlatformAuditLog row in the same transaction; no password, code or secret ever reaches `detail`.
 */
export const ADMIN_MIN_PASSWORD_LENGTH = 16;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export function normalizeAdminIdentifier(raw: string): string {
  const identifier = raw.trim().toLowerCase();
  if (!IDENTIFIER.test(identifier)) throw new DomainError("platform.admin_identifier_invalid");
  return identifier;
}

/** At least 16 characters (stricter than owners' 12) and the shared policy. */
export function assertAdminPassword(password: string, identifier: string): void {
  if ([...password].length < ADMIN_MIN_PASSWORD_LENGTH) throw new DomainError("platform.admin_password_too_short");
  if (checkPassword(password, { identifier })) throw new DomainError("platform.password_weak");
}

async function requireAdmin(tx: PlatformTx, identifier: string) {
  const admin = await findAdminByIdentifier(tx, identifier);
  if (!admin) throw new DomainError("platform.admin_not_found");
  return admin;
}

/** A new admin with a password and no second factor yet: login is refused until `finishAdminTotp`. */
export async function createPlatformAdmin(input: { identifier: string; password: string; actor: string }): Promise<void> {
  const actor = requireActor(input.actor);
  const identifier = normalizeAdminIdentifier(input.identifier);
  assertAdminPassword(input.password, identifier);
  const passwordHash = await hashPassword(input.password);
  try {
    await platformTransaction(async (tx) => {
      const created = await insertAdmin(tx, { identifier, passwordHash });
      await writeAudit(tx, { action: "admin.create", tenantId: null, actor, detail: { adminId: created.id, identifier } });
    });
  } catch (error) {
    if (isUniqueViolation(error, "identifier")) throw new DomainError("platform.admin_identifier_taken");
    throw error;
  }
}

/**
 * Start enrolling: a fresh secret and the otpauth URI for the QR. Nothing is saved; only a valid
 * code (`finishAdminTotp`) stores the secret. Refuses an admin who is already enrolled.
 */
export async function beginAdminTotp(input: { identifier: string }): Promise<{ secretBase32: string; uri: string }> {
  const identifier = normalizeAdminIdentifier(input.identifier);
  loadTotpKey(); // fail before showing a QR that could never be saved
  const admin = await platformTransaction((tx) => requireAdmin(tx, identifier));
  if (admin.totpSecretEnc) throw new DomainError("platform.admin_already_enrolled");
  const secretBase32 = newTotpSecretBase32();
  return { secretBase32, uri: otpauthUri({ secretBase32, account: identifier }) };
}

/** Save the secret (encrypted) and the step of the code that proved it. A wrong code saves nothing. */
export async function finishAdminTotp(input: {
  identifier: string;
  secretBase32: string;
  code: string;
  actor: string;
  now?: Date;
}): Promise<void> {
  const actor = requireActor(input.actor);
  const identifier = normalizeAdminIdentifier(input.identifier);
  const key = loadTotpKey();
  const secret = decodeBase32(input.secretBase32);
  if (!secret || secret.length === 0) throw new DomainError("platform.totp_invalid");
  const step = verifyTotp(secret, input.code.trim(), stepAt(((input.now ?? new Date()).getTime()) / 1000));
  if (step === null) throw new DomainError("platform.totp_invalid");

  await platformTransaction(async (tx) => {
    const admin = await requireAdmin(tx, identifier);
    if (admin.totpSecretEnc) throw new DomainError("platform.admin_already_enrolled");
    await setTotpSecret(tx, admin.id, encryptTotpSecret(input.secretBase32, key, admin.id), step);
    await writeAudit(tx, { action: "admin.enroll_totp", tenantId: null, actor, detail: { adminId: admin.id, identifier } });
  });
}

/** Lost phone: forget the secret and end every session of that admin. The admin enrolls again. */
export async function resetAdminTotp(input: { identifier: string; actor: string }): Promise<void> {
  const actor = requireActor(input.actor);
  const identifier = normalizeAdminIdentifier(input.identifier);
  await platformTransaction(async (tx) => {
    const admin = await requireAdmin(tx, identifier);
    await clearTotp(tx, admin.id);
    const sessions = await deleteSessionsForAdmin(tx, admin.id);
    await writeAudit(tx, { action: "admin.reset_totp", tenantId: null, actor, detail: { adminId: admin.id, identifier, sessionsEnded: sessions } });
  });
}

/** A new password; every session of that admin ends. */
export async function setPlatformAdminPassword(input: { identifier: string; password: string; actor: string }): Promise<void> {
  const actor = requireActor(input.actor);
  const identifier = normalizeAdminIdentifier(input.identifier);
  assertAdminPassword(input.password, identifier);
  const passwordHash = await hashPassword(input.password);
  await platformTransaction(async (tx) => {
    const admin = await requireAdmin(tx, identifier);
    await setPassword(tx, admin.id, passwordHash);
    const sessions = await deleteSessionsForAdmin(tx, admin.id);
    await writeAudit(tx, { action: "admin.set_password", tenantId: null, actor, detail: { adminId: admin.id, identifier, sessionsEnded: sessions } });
  });
}

/** Identifier, enrolled or not, created. Never a hash or a secret. */
export async function listPlatformAdmins() {
  return platformTransaction((tx) => readAdmins(tx));
}
