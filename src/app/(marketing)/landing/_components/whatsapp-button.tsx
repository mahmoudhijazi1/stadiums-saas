import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { landingWhatsAppHref } from "@/app/(marketing)/landing/_components/landing-contact";

/** A plain speech bubble (not a brand mark): the label says WhatsApp. */
export function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-5 shrink-0" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.3L3 20.5l1.8-5.4A8.4 8.4 0 1 1 21 11.5Z" className="stroke-current" />
    </svg>
  );
}

/** The WhatsApp button: an icon and one word. One per screen area (the hero and the closing band). */
export function WhatsAppButton({ locale }: { locale: UiLocale }) {
  return (
    <a
      href={landingWhatsAppHref(locale)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChatIcon />
      {ui("landing.whatsappCta", locale)}
    </a>
  );
}
