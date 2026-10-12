import { ChevronRight, MapPin, MessageCircle, Phone } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { PitchArc } from "@/modules/stadium/ui/pitch-arc";
import { dayTabClass } from "@/modules/venue/ui/day-chip-class";

/** Sample days (today first) and their free-time dots, as on the public day strip. */
const DAYS = [
  { key: "public.today", day: 15, dots: 3 },
  { key: "landing.previewDay2", day: 16, dots: 2 },
  { key: "landing.previewDay3", day: 17, dots: 1 },
  { key: "landing.previewDay4", day: 18, dots: 3 },
  { key: "landing.previewDay5", day: 19, dots: 0 },
] as const;

/** Sample hours in time order; the first free one is the nearest. Times are not translated. */
const SLOTS = [
  { range: "18:00 – 19:00", free: false },
  { range: "19:00 – 20:00", free: true },
  { range: "20:00 – 21:00", free: true },
  { range: "21:00 – 22:00", free: false },
  { range: "22:00 – 23:00", free: true },
] as const;

const PART = "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 type-label whitespace-nowrap text-ink";

/**
 * A snapshot of a stadium's public page, built from the page's own pieces and classes (the header
 * band's gradient and pitch arc, the action bar, the day tabs with their dots, the time rows with
 * the "Nearest" pill and the faded taken ones) and the page's own copy keys. Placeholder name and
 * address; sample days and hours. Decorative (aria-hidden): nothing in it is a link or a button.
 */
export function PublicPagePreview({ locale }: { locale: UiLocale }) {
  const t = (key: string) => ui(key, locale);
  const nearest = SLOTS.find((slot) => slot.free);
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[2rem] border bg-background shadow-xl select-none sm:border-[5px]">
      <div className="relative overflow-hidden bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_20%,var(--bg)),var(--bg))] px-4 pt-5 pb-4">
        <div className="flex items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground">
              {t("landing.previewLogo")}
            </span>
            <p className="w-full min-w-0 truncate font-display text-2xl leading-tight font-extrabold">{t("landing.previewStadium")}</p>
            <p className="type-secondary flex w-full min-w-0 items-center gap-1.5">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">{t("landing.previewAddress")}</span>
            </p>
          </div>
          <PitchArc className="-me-4 size-20 shrink-0 text-accent-brand opacity-30" />
        </div>
        <div className="mt-4 flex flex-nowrap divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <span className={PART}>
            <MapPin aria-hidden className="size-4 shrink-0" />
            {t("public.actionMap")}
          </span>
          <span className={PART}>
            <Phone aria-hidden className="size-4 shrink-0" />
            {t("public.actionCall")}
          </span>
          <span className={PART}>
            <MessageCircle aria-hidden className="size-4 shrink-0" />
            {t("public.actionWhatsapp")}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2 pb-5">
        <ul className="flex gap-1.5">
          {DAYS.map((day, index) => {
            const selected = index === 0;
            return (
              <li key={day.key} className="min-w-0 flex-1">
                <span className={dayTabClass(selected)}>
                  <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                    <span className={`w-full truncate text-center ${selected ? "text-selected-ink" : "text-ink-muted"}`}>{t(day.key)}</span>
                    <LtrIsolate className={`text-sm leading-none font-extrabold ${selected ? "text-selected-ink" : "text-ink"}`}>{String(day.day)}</LtrIsolate>
                    <span className="flex h-[5px] items-center gap-[3px]">
                      {day.dots === 0 ? (
                        <span className={`size-[5px] rounded-full border ${selected ? "border-selected-ink" : "border-ink-muted"}`} />
                      ) : (
                        Array.from({ length: day.dots }, (_, dot) => (
                          <span key={dot} className={`size-[3px] rounded-full ${selected ? "bg-selected-ink" : "bg-ink-muted"}`} />
                        ))
                      )}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="type-title">{t("public.availableTimes")}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {SLOTS.map((slot) => (
            <li key={slot.range} className={`flex min-h-12 items-center gap-3 px-4 ${slot.free ? "" : "opacity-60"}`}>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <LtrIsolate className="type-strong">{slot.range}</LtrIsolate>
                {slot === nearest ? (
                  <span className="type-caption shrink-0 rounded-full bg-[color-mix(in_oklab,var(--brand)_6%,var(--surface))] px-2 py-0.5 font-semibold text-action-ink">
                    {t("public.nearest")}
                  </span>
                ) : null}
              </span>
              {slot.free ? (
                <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted rtl:-scale-x-100" />
              ) : (
                <span className="type-label text-ink">{t("public.taken")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
