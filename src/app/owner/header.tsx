import { submitLogout } from "@/app/login/actions";
import { LangToggle } from "@/components/lang-toggle";
import { Container } from "@/components/ui/container";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { LogOut } from "lucide-react";

/**
 * Full-width dark block on the content column. At lg it sits beside the
 * rail, still inside that column — not a second floating card.
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
    <header className="sticky top-0 z-20 bg-inverse text-inverse-ink dark:border-b dark:border-line dark:bg-surface dark:text-ink">
      <Container className="flex items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-base leading-tight font-medium">
            {tenantName}
          </p>
          <p className="mt-0.5 truncate text-xs text-inverse-ink/70 dark:text-ink-muted">
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
            className="rounded-[var(--radius-control)] text-inverse-ink hover:bg-inverse-ink/10 hover:text-inverse-ink dark:text-ink dark:hover:bg-surface-2 dark:hover:text-ink"
          />
          <form action={submitLogout}>
            <SubmitButton
              variant="ghost"
              size="icon-sm"
              aria-label={logoutLabel}
              className="rounded-[var(--radius-control)] text-inverse-ink hover:bg-inverse-ink/10 hover:text-inverse-ink dark:text-ink dark:hover:bg-surface-2 dark:hover:text-ink"
            >
              <LogOut className="size-4" />
            </SubmitButton>
          </form>
        </div>
      </Container>
    </header>
  );
}
