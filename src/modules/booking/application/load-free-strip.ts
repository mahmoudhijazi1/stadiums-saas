import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import {
  businessDate,
  businessDayUtcRange,
} from "@/modules/booking/domain/business-day";
import {
  buildFreeStrip,
  pendingKey,
  type FreeStripPitch,
} from "@/modules/booking/domain/free-strip";
import { resolveOwnerDay } from "@/modules/booking/domain/start-day";
import { countPendingBySlot } from "@/modules/booking/infrastructure/bookings";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import { compareCivilDate, formatCivilDate } from "@/modules/venue/domain/availability";

const TIME_ZONE = "Asia/Beirut";

export type FreeStrip =
  /** Past day, or nothing to show (no pitches, or every pitch is full / over for today). */
  | { kind: "none" }
  /** No pitch has opening hours on this day. */
  | { kind: "closed" }
  | {
      kind: "free";
      /** Pitch names are shown only when the stadium has more than one. */
      showPitchNames: boolean;
      pitches: FreeStripPitch[];
      /** `YYYY-MM-DD` of the business day, for the booking form's return. */
      day: string;
    };

/**
 * Free slots for one Today business day (Beirut, from the tenant's day start hour). Three reads, all
 * batched: pitches, APPROVED ranges, PENDING counts per slot. The slots come from
 * the availability engine; Booking decides which are still free. `now` is injectable.
 */
export async function loadFreeStrip(
  dateParam: string | undefined,
  now: Date = new Date(),
): Promise<FreeStrip> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const tenant = await getCurrentTenant();
    const today = businessDate(now, tenant.dayStartHour, TIME_ZONE);
    const day = resolveOwnerDay(dateParam, today);
    if (compareCivilDate(day, today) < 0) return { kind: "none" };

    const locale = await getUiLocale();
    const range = businessDayUtcRange(day, tenant.dayStartHour, TIME_ZONE);
    const [pitches, approved, pendingRows] = await Promise.all([
      getDayAvailability({
        localDate: day,
        timeZone: TIME_ZONE,
        now,
        today,
        hourCycle: tenant.timeDisplay,
        locale,
      }),
      listApprovedOccupied(),
      countPendingBySlot(db, range.start, range.end),
    ]);
    if (pitches.length === 0) return { kind: "none" };
    if (pitches.every((pitch) => pitch.emptyKind === "closed")) {
      return { kind: "closed" };
    }

    const pending = new Map(
      pendingRows.map((row) => [pendingKey(row.pitchId, row.start), row.count]),
    );
    const strip = buildFreeStrip(
      pitches.flatMap((pitch) =>
        pitch.slots.map((slot) => ({
          pitchId: pitch.id,
          pitchName: pitch.name,
          defaultPriceUsd: pitch.defaultPriceUsd,
          ...slot,
        })),
      ),
      approved,
      pending,
      now,
    );
    if (strip.length === 0) return { kind: "none" };
    return {
      kind: "free",
      showPitchNames: pitches.length > 1,
      pitches: strip,
      day: formatCivilDate(day),
    };
  } catch (error) {
    return await rethrowUnexpected(error, "Load free strip failed", "loadFreeStrip");
  }
}
