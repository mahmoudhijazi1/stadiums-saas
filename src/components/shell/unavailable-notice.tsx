import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { LangToggle } from "@/components/shell/lang-toggle";
import { Container } from "@/components/ui/container";

/**
 * Neutral page for a suspended tenant (decision 7). No tenant name, no data,
 * no reason: only fixed copy. `owner` speaks to the stadium's staff, `public`
 * to players.
 */
export function UnavailableNotice({
  kind,
  locale,
  onChangeLocale,
}: {
  kind: "owner" | "public";
  locale: UiLocale;
  /** The real Server Action (setUiLocale); the language control shows when it is passed. */
  onChangeLocale?: (value: string) => Promise<unknown>;
}) {
  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
      className="flex min-h-svh flex-col justify-center py-10"
    >
      <Container className="flex flex-col gap-3">
        {onChangeLocale ? (
          <div className="flex justify-end">
            <LangToggle locale={locale} onChangeLocale={onChangeLocale} />
          </div>
        ) : null}
        <h1 className="font-heading text-2xl leading-tight">
          {ui(`unavailable.${kind}.title`, locale)}
        </h1>
        <p className="text-base text-muted-foreground">{ui(`unavailable.${kind}.body`, locale)}</p>
      </Container>
    </main>
  );
}
