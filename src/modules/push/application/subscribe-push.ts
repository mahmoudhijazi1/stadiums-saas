import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { parseUiLocale } from "@/lib/locale";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { requireCurrentSession } from "@/modules/access/application/require-session";
import { validatePushEndpoint } from "@/modules/push/domain/push-endpoint";
import { validatePushKeys } from "@/modules/push/domain/push-keys";
import {
  deleteOwnByEndpoint,
  trimUserSubscriptions,
  upsertSubscription,
} from "@/modules/push/infrastructure/subscriptions";

/**
 * Register THIS browser for the logged-in user (any role). The user and the session come from
 * the cookie; the endpoint and keys come from the browser and are validated before storage (the
 * server will POST to that endpoint later). Idempotent: the same endpoint again updates the row,
 * and an endpoint that belonged to another user, session or tenant on this device is taken over.
 * Authorize first, then one transaction (upsert + trim to 10) that this use case owns.
 */
export async function subscribePush(input: {
  endpoint: unknown;
  keys: unknown;
  locale: unknown;
}): Promise<void> {
  const { userId, sessionId } = await requireCurrentSession();
  try {
    const endpoint = validatePushEndpoint(input.endpoint);
    const keys = validatePushKeys(input.keys);
    if (!endpoint.ok || !keys) {
      logger.info("Push subscribe refused: invalid endpoint or keys", undefined, {
        useCase: "subscribePush",
        tenantId: await safeTenantId(),
      });
      throw new DomainError("push.invalid_subscription");
    }

    await db.$transaction(async (tx) => {
      await upsertSubscription(tx, {
        userId,
        sessionId,
        endpoint: endpoint.url,
        p256dh: keys.p256dh,
        auth: keys.auth,
        locale: parseUiLocale(typeof input.locale === "string" ? input.locale : undefined),
      });
      await trimUserSubscriptions(tx, userId);
    });
  } catch (error) {
    await rethrowUnexpected(error, "Push subscribe failed", "subscribePush");
  }
}

/** Remove THIS user's row for that endpoint. Another user's row is never touched. */
export async function unsubscribePush(input: { endpoint: unknown }): Promise<{ removed: number }> {
  const { userId } = await requireCurrentSession();
  try {
    if (typeof input.endpoint !== "string" || input.endpoint.length === 0 || input.endpoint.length > 2048) {
      return { removed: 0 };
    }
    return { removed: await deleteOwnByEndpoint(userId, input.endpoint) };
  } catch (error) {
    return await rethrowUnexpected(error, "Push unsubscribe failed", "unsubscribePush");
  }
}
