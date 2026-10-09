import { DomainError } from "@/lib/errors";
import { parseUiLocale } from "@/lib/locale";
import { logger } from "@/lib/logger";
import { hitRateLimit } from "@/lib/rate-limit";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { requireCurrentSession } from "@/modules/access/application/require-session";
import { getPushSender } from "@/modules/push/application/push-sender";
import { pushSendOptions } from "@/modules/push/domain/push-options";
import { buildPushPayload, serializePushPayload } from "@/modules/push/domain/push-payload";
import { readPushConfig } from "@/modules/push/infrastructure/push-config";
import {
  deleteSubscriptionById,
  listOwnSubscriptions,
} from "@/modules/push/infrastructure/subscriptions";

const TEST_WINDOW_MS = 10 * 60 * 1000;
const TEST_MAX_PER_WINDOW = 5;

export type TestPushResult = { devices: number; sent: number; removed: number; failed: number };

/**
 * Send a TEST notification to the CURRENT USER's devices in this tenant, and nobody else's.
 * 5 per 10 minutes per user (RateLimit table, hit before any send). A `gone` answer deletes
 * that row; `retry` keeps it. Logs the push service HOST and the outcome, never the endpoint
 * path (it is a bearer address), the keys or the payload.
 */
export async function sendTestPush(): Promise<TestPushResult> {
  const { userId } = await requireCurrentSession();
  try {
    if (!readPushConfig()) throw new DomainError("push.not_configured");
    if ((await hitRateLimit(`pushtest:${userId}`, TEST_WINDOW_MS)) > TEST_MAX_PER_WINDOW) {
      throw new DomainError("push.rate_limited");
    }

    const tenantName = (await getCurrentTenant()).name;
    const sender = getPushSender();
    const devices = await listOwnSubscriptions(userId);
    const result: TestPushResult = { devices: devices.length, sent: 0, removed: 0, failed: 0 };
    const tenantId = await safeTenantId();

    for (const device of devices) {
      const payload = buildPushPayload("TEST", parseUiLocale(device.locale), tenantName);
      const outcome = await sender.send(
        { endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth },
        serializePushPayload(payload),
        pushSendOptions("TEST", payload.tag),
      );
      const status = outcome.statusCode ? ` status=${outcome.statusCode}` : "";
      logger.info(`Push test ${outcome.outcome} host=${hostOf(device.endpoint)}${status}`, undefined, {
        useCase: "sendTestPush",
        tenantId,
      });
      if (outcome.outcome === "ok") {
        result.sent += 1;
      } else if (outcome.outcome === "gone") {
        await deleteSubscriptionById(device.id);
        result.removed += 1;
      } else {
        result.failed += 1;
      }
    }
    return result;
  } catch (error) {
    return await rethrowUnexpected(error, "Send test push failed", "sendTestPush");
  }
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "invalid";
  }
}
