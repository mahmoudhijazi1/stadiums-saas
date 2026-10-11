import { MapPin, MessageCircle, Phone } from "lucide-react";
import { isAllowedMapLink } from "@/modules/stadium/domain/map-link";
import { toLebanonNumber } from "@/modules/people/domain/phone";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { whatsAppChatHref } from "@/modules/notification/domain/whatsapp-link";

/** The plain WhatsApp chat link with the stadium (no text), or null when no valid number is set. */
export function stadiumChatHref(whatsapp: string): string | null {
  return whatsapp !== "" && toLebanonNumber(whatsapp) !== null ? whatsAppChatHref(whatsapp) : null;
}

const PART =
  "flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 type-label whitespace-nowrap text-ink outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-brand";

/**
 * The stadium's own action bar on its public page, three equal parts with thin dividers (icon and a
 * short label, 48px, never wrapping; a part that is not set is omitted and the rest share the width): Open in Maps (only when a link is set),
 * Call and WhatsApp (a plain chat with no prefilled text). Only this stadium's values reach here
 * (`getCurrentTenant`), and each one is checked again before it becomes a link: the map link by the
 * same host rule that saved it, the phones by the Lebanese rule. Nothing set, nothing rendered.
 */
export function StadiumContact({
  mapLink,
  phone,
  whatsapp,
  locale,
}: {
  mapLink: string;
  phone: string;
  whatsapp: string;
  locale: UiLocale;
}) {
  const maps = mapLink !== "" && isAllowedMapLink(mapLink) ? mapLink : null;
  const callNumber = phone !== "" ? toLebanonNumber(phone) : null;
  const chatNumber = whatsapp !== "" && toLebanonNumber(whatsapp) !== null ? whatsapp : null;
  if (!maps && !callNumber && !chatNumber) return null;

  return (
    <div className="flex flex-nowrap divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {maps ? (
        <a href={maps} target="_blank" rel="noopener noreferrer" className={PART} aria-label={ui("public.openInMaps", locale)}>
          <MapPin aria-hidden className="size-5 shrink-0" />
          {ui("public.actionMap", locale)}
        </a>
      ) : null}
      {callNumber ? (
        <a href={`tel:+${callNumber}`} className={PART} aria-label={ui("public.call", locale)}>
          <Phone aria-hidden className="size-5 shrink-0" />
          {ui("public.actionCall", locale)}
        </a>
      ) : null}
      {chatNumber ? (
        <a href={whatsAppChatHref(chatNumber)} target="_blank" rel="noopener noreferrer" className={PART} aria-label={ui("public.whatsapp", locale)}>
          <MessageCircle aria-hidden className="size-5 shrink-0" />
          {ui("public.actionWhatsapp", locale)}
        </a>
      ) : null}
    </div>
  );
}
