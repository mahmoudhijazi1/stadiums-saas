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

const BUTTON =
  "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink outline-none hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The stadium's own contact buttons on its public page: Open in Maps (only when a link is set),
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
    <div className="flex flex-nowrap gap-2">
      {maps ? (
        <a href={maps} target="_blank" rel="noopener noreferrer" className={BUTTON} aria-label={ui("public.openInMaps", locale)}>
          <MapPin aria-hidden className="size-5" />
        </a>
      ) : null}
      {callNumber ? (
        <a href={`tel:+${callNumber}`} className={BUTTON} aria-label={ui("public.call", locale)}>
          <Phone aria-hidden className="size-5" />
        </a>
      ) : null}
      {chatNumber ? (
        <a href={whatsAppChatHref(chatNumber)} target="_blank" rel="noopener noreferrer" className={BUTTON} aria-label={ui("public.whatsapp", locale)}>
          <MessageCircle aria-hidden className="size-5" />
        </a>
      ) : null}
    </div>
  );
}
