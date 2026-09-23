"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight } from "lucide-react";
import { setUiLocale } from "@/app/locale-actions";
import { ShareCard } from "@/app/owner/share-card";
import { submitSetExchangeRate, submitSetTimeDisplay } from "@/app/owner/more/settings/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  htmlDir,
  htmlLang,
  type UiLocale,
} from "@/lib/locale";
import type { TimeDisplay } from "@/lib/tenant-settings";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

type SheetId =
  | "rate"
  | "rules"
  | "public"
  | "language"
  | "appearance"
  | "time"
  | "account";

const rowClass =
  "flex min-h-14 w-full items-center justify-between gap-3 bg-card px-4 py-3 text-start text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const choiceClass =
  "flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-start text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function RowValue({ children }: { children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span className="truncate">{children}</span>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 rtl:rotate-180"
      />
    </span>
  );
}

function AppearanceValue({ locale }: { locale: UiLocale }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  const choice =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";
  return <>{ui(`theme.${choice}`, locale)}</>;
}

/**
 * Grouped More hub. Business rows need settings.manage.
 * Preferences save on tap through the existing locale, theme, and time actions.
 */
export function MoreHub({
  locale,
  mayManage,
  pitchCount,
  rateDigits,
  rateGrouped,
  changedLabel,
  timeDisplay,
  identifier,
}: {
  locale: UiLocale;
  mayManage: boolean;
  pitchCount: number;
  rateDigits: string | null;
  rateGrouped: string | null;
  changedLabel: string | null;
  timeDisplay: TimeDisplay;
  identifier: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const timeLabel =
    timeDisplay === "h12"
      ? ui("owner.timeDisplayH12", locale)
      : ui("owner.timeDisplayH23", locale);

  async function chooseLocale(next: UiLocale) {
    if (next === locale) {
      setSheet(null);
      return;
    }
    document.documentElement.lang = htmlLang(next);
    document.documentElement.dir = htmlDir(next);
    await setUiLocale(next);
    setSheet(null);
    router.refresh();
  }

  async function chooseTime(next: TimeDisplay) {
    const data = new FormData();
    data.set("timeDisplay", next);
    await submitSetTimeDisplay(data);
  }

  return (
    <div className="flex flex-col gap-6">
      {mayManage ? (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-medium text-muted-foreground">
            {ui("owner.groupBusiness", locale)}
          </h3>
          <ul className="overflow-hidden rounded-xl border">
            <li className="border-b">
              <Link href="/owner/more/settings/pitches" className={rowClass}>
                <span className="font-medium">{ui("owner.pitches", locale)}</span>
                <RowValue>
                  <LtrIsolate>{String(pitchCount)}</LtrIsolate>
                </RowValue>
              </Link>
            </li>
            <li className="border-b">
              <button type="button" className={rowClass} onClick={() => setSheet("rate")}>
                <span className="font-medium">{ui("owner.rate", locale)}</span>
                <RowValue>
                  {rateGrouped ? (
                    <LtrIsolate>{rateGrouped}</LtrIsolate>
                  ) : (
                    ui("owner.noRate", locale)
                  )}
                </RowValue>
              </button>
            </li>
            <li className="border-b">
              <button type="button" className={rowClass} onClick={() => setSheet("rules")}>
                <span className="font-medium">{ui("owner.bookingRules", locale)}</span>
                <RowValue>{ui("owner.bookingRulesValue", locale)}</RowValue>
              </button>
            </li>
            <li>
              <button type="button" className={rowClass} onClick={() => setSheet("public")}>
                <span className="font-medium">{ui("owner.publicPage", locale)}</span>
                <RowValue>
                  <LtrIsolate>/</LtrIsolate>
                </RowValue>
              </button>
            </li>
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-medium text-muted-foreground">
          {ui("owner.groupPreferences", locale)}
        </h3>
        <ul className="overflow-hidden rounded-xl border">
          <li className="border-b">
            <button type="button" className={rowClass} onClick={() => setSheet("language")}>
              <span className="font-medium">{ui("owner.language", locale)}</span>
              <RowValue>
                {ui(locale === "en" ? "public.langEnglish" : "public.langArabic", locale)}
              </RowValue>
            </button>
          </li>
          <li className="border-b">
            <button type="button" className={rowClass} onClick={() => setSheet("appearance")}>
              <span className="font-medium">{ui("owner.appearance", locale)}</span>
              <RowValue>
                <AppearanceValue locale={locale} />
              </RowValue>
            </button>
          </li>
          <li>
            <button type="button" className={rowClass} onClick={() => setSheet("time")}>
              <span className="font-medium">{ui("owner.timeDisplay", locale)}</span>
              <RowValue>
                <LtrIsolate>{timeLabel}</LtrIsolate>
              </RowValue>
            </button>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-medium text-muted-foreground">
          {ui("owner.account", locale)}
        </h3>
        <ul className="overflow-hidden rounded-xl border">
          <li>
            <button type="button" className={rowClass} onClick={() => setSheet("account")}>
              <span className="font-medium">{ui("owner.identifier", locale)}</span>
              <RowValue>
                <LtrIsolate>{identifier}</LtrIsolate>
              </RowValue>
            </button>
          </li>
        </ul>
      </section>

      <BottomSheet open={sheet !== null} onOpenChange={(next) => { if (!next) setSheet(null); }}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          {sheet === "rate" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.rate", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {rateGrouped ? (
                    <LtrIsolate className="text-base font-medium text-foreground">
                      {rateGrouped}
                    </LtrIsolate>
                  ) : (
                    ui("owner.noRate", locale)
                  )}
                </p>
                {changedLabel ? (
                  <p className="text-sm text-muted-foreground">
                    {ui("owner.rateLastChanged", locale)}
                    {" · "}
                    <LtrIsolate>{changedLabel}</LtrIsolate>
                  </p>
                ) : null}
                <form action={submitSetExchangeRate} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lbpPerUsd">{ui("owner.newRate", locale)}</Label>
                    <Input
                      id="lbpPerUsd"
                      dir="ltr"
                      type="text"
                      name="lbpPerUsd"
                      required
                      inputMode="numeric"
                      defaultValue={rateDigits ?? ""}
                      className="font-mono"
                    />
                  </div>
                  <SubmitButton className="w-full">
                    {ui("owner.updateRate", locale)}
                  </SubmitButton>
                </form>
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "rules" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.bookingRules", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody>
                <p className="text-sm">{ui("owner.bookingRulesBody", locale)}</p>
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "public" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.publicPage", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody>
                <ShareCard locale={locale} />
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "language" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.language", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody className="flex flex-col gap-2">
                {(["ar", "en"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={locale === choice}
                    className={cn(
                      choiceClass,
                      locale === choice
                        ? "bg-selected text-selected-ink"
                        : "hover:bg-muted/60",
                    )}
                    onClick={() => chooseLocale(choice)}
                  >
                    {ui(choice === "en" ? "public.langEnglish" : "public.langArabic", locale)}
                  </button>
                ))}
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "appearance" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.appearance", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody>
                <ThemeToggle locale={locale} className="flex w-full" />
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "time" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.timeDisplay", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody className="flex flex-col gap-2">
                {(["h23", "h12"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={timeDisplay === choice}
                    className={cn(
                      choiceClass,
                      timeDisplay === choice
                        ? "bg-selected text-selected-ink"
                        : "hover:bg-muted/60",
                    )}
                    onClick={() => chooseTime(choice)}
                  >
                    <LtrIsolate>
                      {ui(
                        choice === "h12" ? "owner.timeDisplayH12" : "owner.timeDisplayH23",
                        locale,
                      )}
                    </LtrIsolate>
                  </button>
                ))}
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "account" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.identifier", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody>
                <LtrIsolate className="text-lg font-medium">{identifier}</LtrIsolate>
              </BottomSheetBody>
            </>
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
