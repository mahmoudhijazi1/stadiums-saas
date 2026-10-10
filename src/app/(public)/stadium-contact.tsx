import { MapPin, MessageCircle, Phone } from "lucide-react";
import { isAllowedMapLink } from "@/lib/map-link";
import { toLebanonNumber } from "@/modules/people/domain/phone";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { whatsAppChatHref } from "@/modules/notification/domain/whatsapp-link";

const BUTTON =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 type-body font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
    <div className="flex flex-wrap gap-2">
      {maps ? (
        <a href={maps} target="_blank" rel="noopener noreferrer" className={BUTTON}>
          <MapPin aria-hidden className="size-4" />
          {ui("public.openInMaps", locale)}
        </a>
      ) : null}
      {callNumber ? (
        <a href={`tel:+${callNumber}`} className={BUTTON}>
          <Phone aria-hidden className="size-4" />
          {ui("public.call", locale)}
        </a>
      ) : null}
      {chatNumber ? (
        <a href={whatsAppChatHref(chatNumber)} target="_blank" rel="noopener noreferrer" className={BUTTON}>
          <MessageCircle aria-hidden className="size-4" />
          {ui("public.whatsapp", locale)}
        </a>
      ) : null}
    </div>
  );
}
