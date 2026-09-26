import { DomainError } from "@/lib/errors";
import { getLiveQueue } from "@/modules/booking/application/get-live-queue";

/**
 * Authenticated, tenant-scoped snapshot for the owner shell.
 * Local route.md: GET returns a Web Response. Not cached.
 * Cannot sit beside requests/page.tsx — this is the /live segment.
 */
export async function GET() {
  try {
    const snapshot = await getLiveQueue();
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DomainError && error.key === "access.not_allowed") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "unavailable" }, { status: 500 });
  }
}
