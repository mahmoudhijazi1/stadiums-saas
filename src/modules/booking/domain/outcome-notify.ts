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
