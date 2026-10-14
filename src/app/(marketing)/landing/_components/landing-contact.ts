import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { SUPPORT_WHATSAPP } from "@/lib/support-contact";
import { whatsAppHref } from "@/modules/notification/domain/whatsapp-link";

/** LebStads's WhatsApp number: the shared support number (`src/lib/support-contact.ts`). */
export const LEBSTADS_WHATSAPP = SUPPORT_WHATSAPP;

/** LebStads on Instagram (@lebstads). */
export const LEBSTADS_INSTAGRAM = "https://www.instagram.com/lebstads/";

/** The click-to-chat link, with a short message in the page's language. */
export function landingWhatsAppHref(locale: UiLocale): string {
  return whatsAppHref(LEBSTADS_WHATSAPP, ui("landing.whatsappMessage", locale));
}
