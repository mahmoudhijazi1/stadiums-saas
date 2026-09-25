import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-display-date";
import { formatLocalHm } from "@/lib/format-local-hm";
import { getUiLocale } from "@/lib/get-ui-locale";
import { logger } from "@/lib/logger";
import { formatUsdCompact } from "@/lib/money";
import { publicPageUrl } from "@/lib/public-page-url";
import { getCurrentTenant } from "@/lib/tenant-context";
import { ui } from "@/lib/ui-copy";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { findBookingFeeState } from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import {
  bookingCancelledByOwnerMessage,
  bookingCancelledByPlayerFeeMessage,
  bookingCancelledByPlayerMessage,
  bookingNoShowFeeMessage,
  bookingNoShowMessage,
  paymentReminderMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";

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
    const person = {
      personId: booking.requesterPersonId,
      name: booking.requesterName,
      phone: booking.requesterPhone,
    };

    if (input.kind === "cancelled") {
      if (booking.status !== "CANCELLED") return null;
      const message = cancelMessage(booking, day, time, locale, tenant.slug);
      return toNotify(
        input,
        person,
        message,
        ui("owner.cancelledShort", locale),
        tenant.id,
      );
    }

    if (input.kind === "no_show") {
      if (booking.status !== "NO_SHOW") return null;
      const message = noShowMessage(booking.amountDueUsd, person.name, day, time, locale);
      return toNotify(
        input,
        person,
        message,
        ui("owner.noShow", locale),
        tenant.id,
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
    const message = paymentReminderMessage({
      name: person.name,
      amount: `$${formatUsdCompact(owed)}`,
      date: day,
      locale,
    });
    return toNotify(
      input,
      person,
      message,
      ui("owner.dueShort", locale),
      tenant.id,
    );
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Load outcome notify failed",
      "loadOutcomeNotify",
    );
  }
}

function cancelMessage(
  booking: {
    requesterName: string;
    amountDueUsd: Decimal;
    dueNote: string | null;
    dueToUsd: Decimal | null;
  },
  day: string,
  time: string,
  locale: "ar" | "en",
  slug: string,
): string {
  const initiator =
    booking.dueNote === "PLAYER" || booking.dueNote === "OWNER"
      ? booking.dueNote
      : null;
  const fee = booking.dueToUsd ?? booking.amountDueUsd;
  const shared = { name: booking.requesterName, day, time, locale };
  if (initiator === "OWNER") {
    return bookingCancelledByOwnerMessage({
      ...shared,
      link: publicPageUrl(slug),
    });
  }
  if (fee.gt(0)) {
    return bookingCancelledByPlayerFeeMessage({
      ...shared,
      fee: `$${formatUsdCompact(fee)}`,
    });
  }
  return bookingCancelledByPlayerMessage(shared);
}

function noShowMessage(
  fee: Decimal,
  name: string,
  day: string,
  time: string,
  locale: "ar" | "en",
): string {
  const shared = { name, day, time, locale };
  if (fee.gt(0)) {
    return bookingNoShowFeeMessage({
      ...shared,
      fee: `$${formatUsdCompact(fee)}`,
    });
  }
  return bookingNoShowMessage(shared);
}

function toNotify(
  input: { bookingId: string; kind: OutcomeKind },
  person: { personId: string; name: string; phone: string | null },
  message: string,
  statusLabel: string,
  tenantId: string,
): OutcomeNotify {
  return {
    bookingId: input.bookingId,
    kind: input.kind,
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
    logger.info("Outcome WhatsApp link skipped", error, {
      useCase: "loadOutcomeNotify",
      tenantId,
    });
    return null;
  }
}
