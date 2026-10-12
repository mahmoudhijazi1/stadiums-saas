import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/**
 * A phone drawn in HTML and CSS with the app's tokens: the "Today" screen with one new request, one
 * confirmed game and an amber "To collect" row. Made-up names, times and amount; no real data.
 * Decorative (aria-hidden): the headline and the steps carry the meaning. Names are not translated
 * text but sample data, so each language shows names that read naturally in it.
 */
export function HeroPhone({ locale }: { locale: UiLocale }) {
  const t = (key: string) => ui(key, locale);
  return (
    <div aria-hidden="true" className="w-full rounded-2xl border bg-card p-3 shadow-lg select-none sm:mx-auto sm:max-w-[280px] sm:rounded-[2rem] sm:border-[5px] sm:shadow-xl">
      <div className="mx-auto mb-3 hidden h-1.5 w-16 rounded-full bg-muted sm:block" />
      <p className="mb-2 px-1 font-semibold sm:mb-3 sm:text-lg">{t("landing.mockToday")}</p>
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-col gap-2 rounded-xl border-2 border-primary bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{t("landing.mockNew")}</span>
            <LtrIsolate className="text-sm font-semibold">{t("landing.mockTime1")}</LtrIsolate>
          </div>
          <p className="text-sm">
            {`${t("landing.mockPitch2")} · `}
            <bdi>{t("landing.mockPlayer1")}</bdi>
          </p>
          <div className="flex gap-2">
            <span className="flex h-9 flex-1 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{t("landing.mockApprove")}</span>
            <span className="flex h-9 flex-1 items-center justify-center rounded-md border text-sm font-semibold">{t("landing.mockReject")}</span>
          </div>
        </div>
        <div className="hidden flex-col gap-2 rounded-xl border bg-background p-3 sm:flex">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-paid-subtle px-2 py-0.5 text-xs font-semibold text-paid">{t("landing.mockConfirmed")}</span>
            <LtrIsolate className="text-sm font-semibold">{t("landing.mockTime2")}</LtrIsolate>
          </div>
          <p className="text-sm">
            {`${t("landing.mockPitch1")} · `}
            <bdi>{t("landing.mockPlayer2")}</bdi>
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-owed/60 bg-owed-subtle px-3 py-2.5 text-sm font-medium text-owed">
          <span>
            {`${t("landing.mockToCollect")} · `}
            <bdi>{t("landing.mockPlayer3")}</bdi>
          </span>
          <LtrIsolate>{t("landing.mockAmount")}</LtrIsolate>
        </div>
      </div>
    </div>
  );
}
