import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { whatsAppHref } from "@/modules/notification/domain/whatsapp-link";

/** LebStads's WhatsApp number (Lebanon, country code 961). Never shown as text; it is only in the link. */
export const LEBSTADS_WHATSAPP = "96178862587";

/** The click-to-chat link, with a short message in the page's language. */
export function landingWhatsAppHref(locale: UiLocale): string {
  return whatsAppHref(LEBSTADS_WHATSAPP, ui("landing.whatsappMessage", locale));
}
