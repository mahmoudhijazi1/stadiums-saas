import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hitRateLimit, pruneRateLimits, rateLimitCount, resetRateLimit } from "@/lib/rate-limit";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { verifyAgainstDummy, verifyPassword } from "@/modules/access/infrastructure/password";
import { decodeBase32 } from "@/modules/platform/domain/base32";
import { ADMIN_SESSION_ABSOLUTE_MS } from "@/modules/platform/domain/admin-session";
import {
  ADMIN_BLOCK_MS,
  ADMIN_FAILURE_WINDOW_MS,
  ADMIN_MAX_FAILURES,
  adminLoginLimitKeys,
} from "@/modules/platform/domain/admin-login-limits";
import { stepAt, verifyTotp } from "@/modules/platform/domain/totp";
import { consumeTotpStep, findAdminByIdentifier } from "@/modules/platform/infrastructure/platform-admins";
import { createPlatformSession, deleteExpiredPlatformSessions } from "@/modules/platform/infrastructure/platform-sessions";
import { platformTransaction, writeAudit } from "@/modules/platform/infrastructure/platform-store";
import { decryptTotpSecret, loadTotpKey } from "@/modules/platform/infrastructure/totp-crypto";

/** One error for every failure, so nothing says which factor was wrong (DR-006). */
const FAILED = "platform.login_failed";

type LimitKeys = ReturnType<typeof adminLoginLimitKeys>;

/**
 * Admin login: identifier, password and a 6-digit code (DR-006). Follows the owner login: limits
 * first and outside any transaction, a dummy scrypt for an unknown identifier, one generic error.
 * Order: password, an enrolled secret, decrypt, verify the code, then `consumeTotpStep` (one atomic
 * UPDATE: a code works once). On success ONE transaction creates the session and writes the
 * `admin.login` audit row (actor `admin:<id>`, no secret). Returns the raw token for the cookie,
 * which the Server Action writes.
 */
export async function platformLogin(input: {
  identifier: string;
  password: string;
  code: string;
  ip: string | null;
  now?: Date;
}): Promise<{ token: string }> {
  // Trim and fold; cap the length so a huge value cannot fill the RateLimit table.
  const identifier = input.identifier.trim().toLowerCase().slice(0, 64);
  const now = input.now ?? new Date();

  try {
    const keys = adminLoginLimitKeys(identifier, input.ip);
    if (await isBlocked(keys)) throw new DomainError("platform.login_blocked");

    const admin = await platformTransaction((tx) => findAdminByIdentifier(tx, identifier));
    const passwordOk = admin
      ? await verifyPassword(input.password, admin.passwordHash)
      : await verifyAgainstDummy(input.password);

    let accepted = false;
    if (admin && passwordOk && admin.totpSecretEnc) {
      accepted = await codeAccepted(admin.id, admin.totpSecretEnc, input.code, now);
    }
    if (!admin || !accepted) {
      await recordFailure(keys);
      throw new DomainError(FAILED);
    }

    await resetRateLimit(keys.account.failures);
    await pruneRateLimits(24 * 60 * 60 * 1000, now);
    const session = await platformTransaction(async (tx) => {
      await deleteExpiredPlatformSessions(tx, admin.id, now);
      const created = await createPlatformSession(tx, admin.id, new Date(now.getTime() + ADMIN_SESSION_ABSOLUTE_MS));
      await writeAudit(tx, { action: "admin.login", tenantId: null, actor: `admin:${admin.id}`, detail: { adminId: admin.id } });
      return created;
    });
    logger.info(`Platform login ${admin.id}`, undefined, { useCase: "platformLogin" });
    return session;
  } catch (error) {
    return await rethrowUnexpected(error, "Platform login failed", "platformLogin");
  }
}

/** Decrypt the secret, check the code against it, and burn the step atomically. False on any problem. */
async function codeAccepted(adminId: string, encrypted: string, code: string, now: Date): Promise<boolean> {
  let secret: Uint8Array | null;
  try {
    secret = decodeBase32(decryptTotpSecret(encrypted, loadTotpKey(), adminId));
  } catch (error) {
    // A wrong or missing PLATFORM_TOTP_KEY, or a damaged value: the admin cannot sign in. Logged, never shown.
    logger.error("Platform admin TOTP secret could not be read", error, { useCase: "platformLogin" });
    return false;
  }
  if (!secret) return false;
  const step = verifyTotp(secret, code.trim(), stepAt(now.getTime() / 1000));
  if (step === null) return false;
  return platformTransaction((tx) => consumeTotpStep(tx, adminId, step));
}

async function isBlocked(keys: LimitKeys): Promise<boolean> {
  if ((await rateLimitCount(keys.account.block, ADMIN_BLOCK_MS)) > 0) return true;
  return keys.ip !== null && (await rateLimitCount(keys.ip.block, ADMIN_BLOCK_MS)) > 0;
}

/** Count a failure; reaching the limit starts a 15-minute block. */
async function recordFailure(keys: LimitKeys): Promise<void> {
  const accountFailures = await hitRateLimit(keys.account.failures, ADMIN_FAILURE_WINDOW_MS);
  if (accountFailures >= ADMIN_MAX_FAILURES) {
    await resetRateLimit(keys.account.failures);
    await hitRateLimit(keys.account.block, ADMIN_BLOCK_MS);
  }
  if (!keys.ip) return;
  const ipFailures = await hitRateLimit(keys.ip.failures, ADMIN_FAILURE_WINDOW_MS);
  if (ipFailures >= ADMIN_MAX_FAILURES) {
    await resetRateLimit(keys.ip.failures);
    await hitRateLimit(keys.ip.block, ADMIN_BLOCK_MS);
  }
}
