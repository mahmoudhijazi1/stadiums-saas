import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { landingWhatsAppHref } from "@/app/(marketing)/landing/_components/landing-contact";

const STYLES = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border bg-card text-foreground hover:bg-muted",
} as const;

/** The WhatsApp link. One "primary" per screen area; the others are "secondary". */
export function WhatsAppButton({ locale, variant = "primary" }: { locale: UiLocale; variant?: keyof typeof STYLES }) {
  return (
    <a
      href={landingWhatsAppHref(locale)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-12 items-center justify-center rounded-md px-6 text-base font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${STYLES[variant]}`}
    >
      {ui("landing.whatsappCta", locale)}
    </a>
  );
}
