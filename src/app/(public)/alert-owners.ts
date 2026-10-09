import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { countPendingForAlert } from "@/modules/booking/application/count-pending-for-alert";
import { notifyNewRequest } from "@/modules/push/application/notify-new-request";

/**
 * Compose the new-request alert. This is the only place booking and push meet (booking never
 * imports push): count what is waiting, then hand the number to push. Scheduled with after()
 * by the public request action, so it runs once the response is sent. It NEVER throws: a
 * failure is logged (the error's name only: no names, phones, endpoints or keys) and the
 * player's result is untouched.
 */
export async function alertOwnersOfNewRequest(): Promise<void> {
  try {
    await notifyNewRequest({ pendingCount: await countPendingForAlert() });
  } catch (error) {
    const kind = error instanceof Error ? error.name : "unknown";
    // The logger has no warn level: info, with the failure named, so it is not mistaken for a bug.
    logger.info(`New-request alert skipped after an error (${kind})`, undefined, {
      useCase: "alertOwnersOfNewRequest",
      tenantId: await safeTenantId().catch(() => undefined),
    });
  }
}
