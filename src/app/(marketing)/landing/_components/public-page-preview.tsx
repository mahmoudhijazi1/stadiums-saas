import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/** Sample hours: the first free one is the nearest; one is taken (faded). Times are not translated. */
const SLOTS = [
  { time: "18:00", state: "taken" },
  { time: "19:00", state: "nearest" },
  { time: "20:00", state: "free" },
  { time: "21:00", state: "taken" },
  { time: "22:00", state: "free" },
] as const;

/**
 * A snapshot of a stadium's public page, drawn in HTML and CSS with the app's tokens (no
 * screenshot): the header band with its accent gradient, logo, name and address, the action bar,
 * the day strip and the list of hours with the "Nearest" badge and a request button. Made-up sample
 * data. Decorative (aria-hidden): the section title and line carry the meaning.
 */
export function PublicPagePreview({ locale }: { locale: UiLocale }) {
  const t = (key: string) => ui(key, locale);
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2rem] border bg-card shadow-xl select-none sm:border-[5px]">
      <div className="bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_20%,var(--bg)),var(--bg))] px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
            {t("landing.previewLogo")}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{t("landing.previewStadium")}</p>
            <p className="truncate text-xs text-muted-foreground">{t("landing.previewAddress")}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["landing.previewMap", "landing.previewCall", "landing.previewWhatsapp"].map((key) => (
            <span key={key} className="rounded-lg border bg-card/80 py-1.5 text-center text-xs font-medium">
              {t(key)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-5">
        <div className="flex gap-2">
          {["landing.previewDay1", "landing.previewDay2", "landing.previewDay3"].map((key, index) => (
            <span
              key={key}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {t(key)}
              <span className={`size-1 rounded-full ${index === 2 ? "bg-owed" : "bg-paid"}`} />
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {SLOTS.map((slot) => (
            <div
              key={slot.time}
              className={`flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2.5 ${slot.state === "taken" ? "opacity-50" : ""}`}
            >
              <span className="flex items-center gap-2">
                <LtrIsolate className="text-sm font-semibold">{slot.time}</LtrIsolate>
                {slot.state === "nearest" ? (
                  <span className="rounded-full bg-paid-subtle px-2 py-0.5 text-[10px] font-semibold text-paid">{t("landing.previewNearest")}</span>
                ) : null}
              </span>
              {slot.state === "taken" ? (
                <span className="text-xs text-muted-foreground">{t("landing.previewTaken")}</span>
              ) : (
                <span className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{t("landing.previewRequest")}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
