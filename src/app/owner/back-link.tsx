import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ui } from "@/lib/ui-copy";
import type { UiLocale } from "@/lib/locale";

/** Back control for nested owner pages. Chevron points to the inline start. */
export function OwnerBackLink({
  href,
  locale,
}: {
  href: string;
  locale: UiLocale;
}) {
  const label = ui("owner.back", locale);
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChevronLeft aria-hidden className="size-5 shrink-0 rtl:rotate-180" />
      {label}
    </Link>
  );
}
