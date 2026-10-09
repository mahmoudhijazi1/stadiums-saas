import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { messageDayLabel } from "@/modules/booking/application/night-hint";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { formatUsdCompact } from "@/lib/money";
import { publicPageUrl } from "@/lib/public-page-url";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/ui-copy";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { findBookingFeeState } from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import type { MessageContext, MessageState } from "@/modules/notification/domain/message-intent";
import { notifyLink, type MessageFacts } from "@/modules/notification/domain/whatsapp-link";

const TIME_ZONE = "Asia/Beirut";

export type OutcomeKind = "cancelled" | "no_show" | "due";

export type OutcomeNotify = {
  bookingId: string;
  kind: OutcomeKind;
  personId: string;
  name: string;
  phone: string | null;
  message: string;
  statusLabel: string;
  whatsAppHref: string | null;
};

/**
 * One send row after cancel, no-show, or adjust. The body is the saved due
 * and status. A mismatched status returns nothing.
 */
export async function loadOutcomeNotify(input: {
  bookingId: string;
  kind: OutcomeKind;
}): Promise<OutcomeNotify | null> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();

  try {
    const booking = await findBookingFeeState(db, input.bookingId);
    if (!booking) return null;

    const locale = await getUiLocale();
    const day = messageDayLabel(booking.start, locale, tenant.dayStartHour);
    const time = formatLocalHm(
      booking.start,
      TIME_ZONE,
      tenant.timeDisplay,
      locale,
    );
    const person = {
      personId: booking.requesterPersonId,
      name: booking.requesterName,
      phone: booking.requesterPhone,
    };

    const facts = (extra: Partial<MessageFacts>): MessageFacts => ({
      name: person.name,
      stadiumName: tenant.name,
      day,
      time,
      ...extra,
    });

    if (input.kind === "cancelled") {
      if (booking.status !== "CANCELLED") return null;
      const initiator =
        booking.dueNote === "PLAYER" || booking.dueNote === "OWNER" ? booking.dueNote : null;
      const fee = booking.dueToUsd ?? booking.amountDueUsd;
      return toNotify(
        input,
        person,
        "after_cancel",
        {},
        facts({
          initiator: initiator ?? undefined,
          link: publicPageUrl(tenant.slug),
          fee: fee.gt(0) ? `$${formatUsdCompact(fee)}` : null,
        }),
        ui("owner.cancelledShort", locale),
        locale,
      );
    }

    if (input.kind === "no_show") {
      if (booking.status !== "NO_SHOW") return null;
      const fee = booking.amountDueUsd;
      return toNotify(
        input,
        person,
        "after_no_show",
        { feeCharged: fee.gt(0) },
        facts({ amount: `$${formatUsdCompact(fee)}` }),
        ui("owner.noShow", locale),
        locale,
      );
    }

    if (
      booking.status !== "APPROVED" &&
      booking.status !== "CANCELLED" &&
      booking.status !== "NO_SHOW"
    ) {
      return null;
    }
    const owed = Decimal.max(
      bookingRemaining(booking.amountDueUsd, booking.collectedUsd),
      0,
    );
    return toNotify(
      input,
      person,
      "after_adjust",
      { owed: owed.gt(0) },
      facts({ amount: `$${formatUsdCompact(owed)}` }),
      ui("owner.dueShort", locale),
      locale,
    );
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Load outcome notify failed",
      "loadOutcomeNotify",
    );
  }
}

function toNotify(
  input: { bookingId: string; kind: OutcomeKind },
  person: { personId: string; name: string; phone: string | null },
  context: MessageContext,
  state: MessageState,
  facts: MessageFacts,
  statusLabel: string,
  locale: "ar" | "en",
): OutcomeNotify {
  const link = notifyLink({ context, state, phone: person.phone, facts, locale });
  return {
    bookingId: input.bookingId,
    kind: input.kind,
    personId: person.personId,
    name: person.name,
    phone: person.phone,
    message: link.message ?? "",
    statusLabel,
    whatsAppHref: link.href,
  };
}
