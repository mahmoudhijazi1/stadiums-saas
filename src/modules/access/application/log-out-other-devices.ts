import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { requireSelf } from "@/modules/access/application/own-credentials";
import { deleteOtherSessions } from "@/modules/access/infrastructure/sessions";

/**
 * Delete every session of the logged-in user except the one making the request.
 * The user comes from the session; returns how many devices were closed.
 */
export async function logOutOtherDevices(): Promise<{ closed: number }> {
  const { userId, token } = await requireSelf();
  try {
    const closed = await deleteOtherSessions(userId, token);
    logger.info("Other devices logged out", undefined, {
      useCase: "logOutOtherDevices",
      tenantId: await safeTenantId(),
    });
    return { closed };
  } catch (error) {
    return await rethrowUnexpected(error, "Log out other devices failed", "logOutOtherDevices");
  }
}
