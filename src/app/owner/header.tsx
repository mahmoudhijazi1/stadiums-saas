import { submitLogout } from "@/app/login/actions";
import { LangToggle } from "@/components/lang-toggle";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";
import { LogOut } from "lucide-react";

const iconButtonClass =
  "rounded-full bg-inverse-ink/10 text-inverse-ink hover:bg-inverse-ink/15 hover:text-inverse-ink dark:lg:bg-ink/10 dark:lg:text-ink dark:lg:hover:bg-ink/15 dark:lg:hover:text-ink";

/**
 * Below lg: a floating inverse bar, inset like the bottom nav.
 * At lg: a full-width dark block on the content column, aligned with Container.
 */
export function OwnerHeader({
  tenantName,
  roleLabel,
  identifier,
  logoutLabel,
  locale,
}: {
  tenantName: string;
  roleLabel: string;
  identifier: string;
  logoutLabel: string;
  locale: UiLocale;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-bg px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2",
        "lg:bg-inverse lg:px-0 lg:pt-0 lg:pb-0 lg:text-inverse-ink",
        "dark:lg:border-b dark:lg:border-line dark:lg:bg-surface dark:lg:text-ink",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3",
          "rounded-[var(--radius-sheet)] border border-line bg-inverse px-4 py-3 text-inverse-ink",
          "lg:mx-auto lg:max-w-5xl lg:rounded-none lg:border-0 lg:bg-transparent lg:px-8 lg:py-3 lg:pt-[max(0.75rem,env(safe-area-inset-top))]",
          "xl:max-w-6xl",
        )}
      >
        <div className="min-w-0">
          <p className="truncate font-heading text-base leading-tight font-medium">
            {tenantName}
          </p>
          <p className="mt-0.5 truncate text-xs text-inverse-ink/70 dark:lg:text-ink-muted">
            {roleLabel}
            <span aria-hidden className="mx-1 opacity-50">
              ·
            </span>
            <LtrIsolate>{identifier}</LtrIsolate>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <LangToggle
            locale={locale}
            variant="ghost"
            size="sm"
            className={iconButtonClass}
          />
          <form action={submitLogout}>
            <SubmitButton
              variant="ghost"
              size="icon-sm"
              aria-label={logoutLabel}
              className={iconButtonClass}
            >
              <LogOut className="size-4" />
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
