import { parseUiLocale } from "@/lib/locale";
import { logger } from "@/lib/logger";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { listApproverUserIds } from "@/modules/access/application/list-approver-user-ids";
import { getPushSender, type PushResult } from "@/modules/push/application/push-sender";
import { mapWithConcurrency } from "@/modules/push/domain/map-with-concurrency";
import { pushSendOptions } from "@/modules/push/domain/push-options";
import { buildPushPayload, serializePushPayload } from "@/modules/push/domain/push-payload";
import { readPushConfig } from "@/modules/push/infrastructure/push-config";
import {
  deleteSubscriptionById,
  listSubscriptionsForUsers,
} from "@/modules/push/infrastructure/subscriptions";

/** At most one NEW_REQUEST per device in this window. A skipped alert is not queued. */
export const ALERT_WINDOW_MS = 120 * 1000;
export const ALERT_CONCURRENCY = 5;
export const ALERT_SEND_TIMEOUT_MS = 5000;

export type NewRequestAlertResult = {
  devices: number;
  sent: number;
  skipped: number;
  removed: number;
  failed: number;
};

type DeviceOutcome = "sent" | "skipped" | "removed" | "failed";

/**
 * Tell the people who can approve that a request is waiting. Called by app/ AFTER the request
 * has committed (never inside its transaction); the caller passes the pending count, so this
 * module never reads Booking.
 *
 * Recipients: members of THIS tenant with bookings.approve, and each of their devices here.
 * Throttle: one alert per device per 120 s (RateLimit key pushalert:<subscriptionId>). The window
 * is claimed BEFORE sending, so two concurrent requests cannot both send. If the send then fails
 * (a retry result, a timeout, an exception) the claim is released, so the next request can try
 * again; a success keeps it. A skipped alert is dropped on purpose: the badge already shows the
 * count, and the next alert carries the full count. Sends run 5 at a time, each capped at 5 s; one failing device never blocks the
 * others. A 404/410 deletes the row; anything else keeps it. Logs counts only.
 *
 * Nothing to do (and no error) when push is not configured, the tenant is suspended, nobody is
 * subscribed, or nothing is waiting.
 */
export async function notifyNewRequest(input: { pendingCount: number }): Promise<NewRequestAlertResult> {
  const result: NewRequestAlertResult = { devices: 0, sent: 0, skipped: 0, removed: 0, failed: 0 };
  if (!readPushConfig() || input.pendingCount <= 0) return result;
  const tenant = await getCurrentTenant();
  if (tenant.suspended) return result;

  const devices = await listSubscriptionsForUsers(await listApproverUserIds());
  result.devices = devices.length;
  if (devices.length === 0) return result;

  const sender = getPushSender();
  const outcomes = await mapWithConcurrency(devices, ALERT_CONCURRENCY, async (device): Promise<DeviceOutcome> => {
    const key = `pushalert:${device.id}`;
    let claimed = false;
    try {
      if ((await hitRateLimit(key, ALERT_WINDOW_MS)) > 1) return "skipped";
      claimed = true;
      const payload = buildPushPayload("NEW_REQUEST", parseUiLocale(device.locale), tenant.name, {
        pendingCount: input.pendingCount,
      });
      const sent = await withTimeout(
        sender.send(
          { endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth },
          serializePushPayload(payload),
          pushSendOptions("NEW_REQUEST", payload.tag),
        ),
        ALERT_SEND_TIMEOUT_MS,
      );
      if (sent.outcome === "ok") return "sent";
      if (sent.outcome === "gone") {
        await deleteSubscriptionById(device.id);
        return "removed";
      }
      await release(key);
      return "failed";
    } catch {
      if (claimed) await release(key);
      return "failed";
    }
  });

  for (const outcome of outcomes) {
    if (outcome === "sent") result.sent += 1;
    else if (outcome === "skipped") result.skipped += 1;
    else if (outcome === "removed") result.removed += 1;
    else result.failed += 1;
  }
  logger.info(
    `New-request alert devices=${result.devices} sent=${result.sent} skipped=${result.skipped} removed=${result.removed} failed=${result.failed}`,
    undefined,
    { useCase: "notifyNewRequest", tenantId: await safeTenantId() },
  );
  return result;
}

/** Give the window back after a failed send. Best effort: a failure to release only means one skipped alert. */
async function release(key: string): Promise<void> {
  await resetRateLimit(key).catch(() => undefined);
}

/** A send that never answers counts as a failure after `ms`; the timer never keeps the process alive. */
function withTimeout(send: Promise<PushResult>, ms: number): Promise<PushResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PushResult>((resolve) => {
    timer = setTimeout(() => resolve({ outcome: "retry" }), ms);
    timer.unref?.();
  });
  return Promise.race([send, timeout]).finally(() => clearTimeout(timer));
}
