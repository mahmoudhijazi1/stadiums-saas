import { hasSeveralPitches } from "@/modules/venue/application/has-several-pitches";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { messageDayLabel } from "@/modules/booking/application/night-hint";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { publicPageUrl } from "@/lib/public-page-url";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/ui-copy";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  findBookingRequester,
  listSlotInterestsWithPeople,
} from "@/modules/booking/infrastructure/bookings";
import type { MessageContext } from "@/modules/notification/domain/message-intent";
import { notifyLink, type MessageFacts } from "@/modules/notification/domain/whatsapp-link";

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
    const day = messageDayLabel(booking.start, locale, tenant.dayStartHour);
    const time = formatLocalHm(
      booking.start,
      TIME_ZONE,
      tenant.timeDisplay,
      locale,
    );
    const link = publicPageUrl(tenant.slug);
    const slotTaken = ui("owner.rejectReason.slotTaken", locale);

    const requester = {
      personId: booking.requesterPersonId,
      name: booking.requesterName,
      phone: booking.requesterPhone,
    };
    const facts = (person: { name: string }, extra: Partial<MessageFacts> = {}): MessageFacts => ({
      name: person.name,
      stadiumName: tenant.name,
      day,
      time,
      link,
      ...extra,
    });

    if (input.kind === "dismissed") {
      return [toRow(requester, "request_dismissed", facts(requester), ui("owner.dismiss", locale), locale)];
    }

    if (input.kind === "rejected") {
      const reason = cleanReason(input.reason);
      return [
        toRow(requester, "after_reject", facts(requester, { reason }), reason || ui("owner.reject", locale), locale),
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

    const showPitch = await hasSeveralPitches();
    return [
      toRow(
        requester,
        "after_approve",
        facts(requester, { pitchName: showPitch ? booking.pitchName : null }),
        ui("owner.notifyConfirmed", locale),
        locale,
      ),
      // The players whose request for this slot was just declined because it was taken.
      ...ordered.map((row) =>
        toRow(row, "request_auto_rejected", facts(row, { reason: slotTaken }), slotTaken, locale),
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

/** One row: what the context is for, the text it carries and its link all come from `notifyLink`. */
function toRow(
  person: { personId: string; name: string; phone: string | null },
  context: MessageContext,
  facts: MessageFacts,
  statusLabel: string,
  locale: "ar" | "en",
): DecisionNotifyRow {
  const link = notifyLink({ context, phone: person.phone, facts, locale });
  return {
    personId: person.personId,
    name: person.name,
    phone: person.phone,
    message: link.message ?? "",
    statusLabel,
    whatsAppHref: link.href,
  };
}

function cleanReason(reason: string | undefined): string {
  return (reason ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}
