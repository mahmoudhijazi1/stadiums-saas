/**
 * What a WhatsApp message is for, decided in ONE place. Every place that offers a WhatsApp link
 * asks `messageIntentFor` and gets an intent or null; no entry point picks a template itself.
 * Null means: open the chat with no text.
 *
 * Domain only: no sending (we build wa.me links the owner taps), no Booking import.
 */
export type MessageIntent =
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "SLOT_AVAILABLE"
  | "PAYMENT_REMINDER";

/** Where the link is offered. */
export type MessageContext =
  /** The call / WhatsApp icon in the booking sheet header. */
  | "booking_header"
  /** The WhatsApp button on a person's page. */
  | "person_page"
  /** Right after approving a request. */
  | "after_approve"
  /** Right after rejecting a request. */
  | "after_reject"
  /** A pending request for the same slot, rejected because the slot was taken. */
  | "request_auto_rejected"
  /** A missed request, dismissed. */
  | "request_dismissed"
  /** Right after cancelling a booking (by the player or by the owner). */
  | "after_cancel"
  /** Right after marking a no-show. */
  | "after_no_show"
  /** Right after changing what is owed on a booking. */
  | "after_adjust"
  /** A slot freed up: told to the players waiting for it. */
  | "freed_slot"
  /** An owed game from an earlier day. */
  | "earlier_debt"
  /** A person's group on the Owed page. */
  | "owed_page";

/** The saved state the decision reads (never a guess: built from what is stored). */
export type MessageState = {
  /** The game has ended (or it was a no-show or cancelled). */
  gameEnded?: boolean;
  /** Money is owed on it: the game due or any tab. */
  owed?: boolean;
  /** A fee was charged (no-show). */
  feeCharged?: boolean;
};

export function messageIntentFor(context: MessageContext, state: MessageState = {}): MessageIntent | null {
  switch (context) {
    case "booking_header":
      return state.gameEnded && state.owed ? "PAYMENT_REMINDER" : null;
    case "person_page":
      return null;
    case "after_approve":
      return "CONFIRMED";
    case "after_reject":
    case "request_auto_rejected":
    case "request_dismissed":
      return "DECLINED";
    case "after_cancel":
      return "CANCELLED";
    case "after_no_show":
      return state.feeCharged ? "PAYMENT_REMINDER" : null;
    case "after_adjust":
      return state.owed ? "PAYMENT_REMINDER" : null;
    case "freed_slot":
      return "SLOT_AVAILABLE";
    case "earlier_debt":
    case "owed_page":
      return "PAYMENT_REMINDER";
  }
}
