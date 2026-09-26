import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { logger } from "@/lib/logger";
import { publicPageUrl } from "@/lib/public-page-url";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/ui-copy";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  findBookingRequester,
  listSlotInterestsWithPeople,
} from "@/modules/booking/infrastructure/bookings";
import {
  bookingConfirmedMessage,
  bookingMissedMessage,
  bookingRejectedMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";

const TIME_ZONE = "Asia/Beirut";

export type DecisionNotifyRow = {
  personId: string;
  name: string;
  phone: string | null;
  message: string;
  statusLabel: string;
  whatsAppHref: string | null;
};

/**
 * Notify rows after approve or reject. Approve lists the requester, then each
 * sibling who was just auto-rejected and now has a slot interest on that window.
 */
export async function loadDecisionNotify(input: {
  bookingId: string;
  kind: "approved" | "rejected" | "dismissed";
  reason?: string;
  siblingIds?: string[];
}): Promise<DecisionNotifyRow[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();

  try {
    const booking = await findBookingRequester(db, input.bookingId);
    if (!booking) return [];
    if (input.kind === "approved" && booking.status !== "APPROVED") return [];
    if (
      (input.kind === "rejected" || input.kind === "dismissed") &&
      booking.status !== "REJECTED"
    ) {
      return [];
    }

    const locale = await getUiLocale();
    const day = formatDisplayDate(booking.start, locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const time = formatLocalHm(
      booking.start,
      TIME_ZONE,
      tenant.timeDisplay,
      locale,
    );
    const link = publicPageUrl(tenant.slug);
    const slotTaken = ui("owner.rejectReason.slotTaken", locale);

    if (input.kind === "dismissed") {
      return [
        toRow(
          {
            personId: booking.requesterPersonId,
            name: booking.requesterName,
            phone: booking.requesterPhone,
          },
          bookingMissedMessage({
            name: booking.requesterName,
            day,
            time,
            link,
            locale,
          }),
          ui("owner.dismiss", locale),
          tenant.id,
        ),
      ];
    }

    if (input.kind === "rejected") {
      const reason = cleanReason(input.reason);
      return [
        toRow(
          {
            personId: booking.requesterPersonId,
            name: booking.requesterName,
            phone: booking.requesterPhone,
          },
          bookingRejectedMessage({
            name: booking.requesterName,
            day,
            time,
            reason,
            link,
            locale,
          }),
          reason || ui("owner.reject", locale),
          tenant.id,
        ),
      ];
    }

    const wanted = new Set(input.siblingIds ?? []);
    const interests = await listSlotInterestsWithPeople(db);
    const siblings = interests.filter(
      (row) =>
        wanted.has(row.personId) &&
        row.personId !== booking.requesterPersonId &&
        row.pitchId === booking.pitchId &&
        row.start.getTime() === booking.start.getTime() &&
        row.end.getTime() === booking.end.getTime(),
    );
    const seen = new Set<string>();
    const ordered = (input.siblingIds ?? [])
      .map((id) => siblings.find((row) => row.personId === id))
      .filter((row): row is (typeof siblings)[number] => {
        if (!row || seen.has(row.personId)) return false;
        seen.add(row.personId);
        return true;
      });

    return [
      toRow(
        {
          personId: booking.requesterPersonId,
          name: booking.requesterName,
          phone: booking.requesterPhone,
        },
        bookingConfirmedMessage({
          name: booking.requesterName,
          stadiumName: tenant.name,
          day,
          time,
          pitchName: booking.pitchName,
          locale,
        }),
        ui("owner.notifyConfirmed", locale),
        tenant.id,
      ),
      ...ordered.map((row) =>
        toRow(
          row,
          bookingRejectedMessage({
            name: row.name,
            day,
            time,
            reason: slotTaken,
            link,
            ending: "wait",
            locale,
          }),
          slotTaken,
          tenant.id,
        ),
      ),
    ];
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Load decision notify failed",
      "loadDecisionNotify",
    );
  }
}

function toRow(
  person: { personId: string; name: string; phone: string | null },
  message: string,
  statusLabel: string,
  tenantId: string,
): DecisionNotifyRow {
  return {
    personId: person.personId,
    name: person.name,
    phone: person.phone,
    message,
    statusLabel,
    whatsAppHref: linkOrNull(person.phone, message, tenantId),
  };
}

function linkOrNull(
  phone: string | null,
  message: string,
  tenantId: string,
): string | null {
  if (!phone) return null;
  try {
    return whatsAppHref(phone, message);
  } catch (error) {
    logger.info("Decision WhatsApp link skipped", error, {
      useCase: "loadDecisionNotify",
      tenantId,
    });
    return null;
  }
}

function cleanReason(reason: string | undefined): string {
  return (reason ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}
