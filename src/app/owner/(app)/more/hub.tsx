"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { setUiLocale } from "@/app/locale-actions";
import { ShareCard } from "@/app/owner/share-card";
import {
  submitSetBookingRules,
  submitSetExchangeRate,
  submitSetTimeDisplay,
} from "@/app/owner/(app)/more/settings/actions";
import { CountedPhrase, RelativeWhen } from "@/app/owner/notify-list";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  htmlDir,
  htmlLang,
  type UiLocale,
} from "@/lib/locale";
import type { TimeDisplay } from "@/lib/tenant-settings";
import { dayStartClock, ui, uiCount } from "@/lib/copy";
import { SelectField } from "@/components/ui/select-field";
import { Figure } from "@/components/ui/figure";
import { SettingsRow, SettingsSection } from "./settings-list";
import { AccountSheetContent } from "./account/account-sheet";
import { NotificationsSheetContent } from "./notifications/notifications-sheet";

type SheetId =
  | "rate"
  | "rules"
  | "public"
  | "language"
  | "appearance"
  | "time"
  | "notifications"
  | "account";

function PercentField({
  name,
  label,
  current,
}: {
  name: string;
  label: string;
  current: number;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 type-label">{label}</legend>
      <div className="flex gap-2">
        {([0, 50, 100] as const).map((percent) => (
          <label
            key={percent}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border has-[:checked]:bg-selected has-[:checked]:text-selected-ink"
          >
            <input
              type="radio"
              name={name}
              value={String(percent)}
              defaultChecked={current === percent}
              className="sr-only"
              required
            />
            <LtrIsolate>{percent}%</LtrIsolate>
          </label>
        ))}
      </div>
    </fieldset>
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
  cancellationWindowHours,
  lateCancellationFeePercent,
  noShowFeePercent,
  perPlayerSplitEnabled,
  dayStartHour,
  riskyDayStartHours,
  identifier,
  slug,
  tenantName,
  publicUrl,
  mayManageShop,
  pushPublicKey,
}: {
  locale: UiLocale;
  mayManage: boolean;
  pitchCount: number;
  rateDigits: string | null;
  rateGrouped: string | null;
  changedLabel: string | null;
  timeDisplay: TimeDisplay;
  cancellationWindowHours: number;
  lateCancellationFeePercent: number;
  noShowFeePercent: number;
  perPlayerSplitEnabled: boolean;
  dayStartHour: number;
  /** Day-start hours (0..6) that fall inside some pitch's opening window. */
  riskyDayStartHours: number[];
  identifier: string;
  /** The tenant slug: the fixed suffix of the login. */
  slug: string;
  tenantName: string;
  /** The canonical public link (same text the QR encodes). */
  publicUrl: string;
  /** shop.manage (owner only): the Shop row. */
  mayManageShop: boolean;
  /** The VAPID public key; null when push is not configured (the Notifications row hides). */
  pushPublicKey: string | null;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [dayStart, setDayStart] = useState(String(dayStartHour));
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
        <SettingsSection title={ui("owner.groupBusiness", locale)}>
          <SettingsRow
            label={ui("owner.pitches", locale)}
            href="/owner/more/settings/pitches"
            value={<LtrIsolate>{String(pitchCount)}</LtrIsolate>}
          />
          <SettingsRow
            label={ui("owner.rate", locale)}
            onClick={() => setSheet("rate")}
            value={rateGrouped ? <LtrIsolate>{rateGrouped}</LtrIsolate> : ui("owner.noRate", locale)}
          />
          <SettingsRow
            label={ui("owner.bookingRules", locale)}
            onClick={() => setSheet("rules")}
            value={
              <>
                {ui("owner.rulesTrailLead", locale)}{" "}
                <CountedPhrase text={uiCount("owner.ruleHours", cancellationWindowHours, locale)} />
                {" · "}
                <LtrIsolate>{lateCancellationFeePercent}%</LtrIsolate>
              </>
            }
          />
          {mayManageShop ? (
            <SettingsRow label={ui("owner.shop", locale)} href="/owner/more/shop" />
          ) : null}
          <SettingsRow label={ui("owner.weeklyBookings", locale)} href="/owner/more/weekly" />
          <SettingsRow label={ui("owner.stadiumInfo", locale)} href="/owner/more/stadium" />
          <SettingsRow
            label={ui("owner.publicPage", locale)}
            onClick={() => setSheet("public")}
            value={<LtrIsolate>/</LtrIsolate>}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={ui("owner.groupPreferences", locale)}>
        <SettingsRow
          label={ui("owner.language", locale)}
          onClick={() => setSheet("language")}
          value={ui(locale === "en" ? "public.langEnglish" : "public.langArabic", locale)}
        />
        <SettingsRow
          label={ui("owner.appearance", locale)}
          onClick={() => setSheet("appearance")}
          value={<AppearanceValue locale={locale} />}
        />
        <SettingsRow
          label={ui("owner.timeDisplay", locale)}
          onClick={() => setSheet("time")}
          value={<LtrIsolate>{timeLabel}</LtrIsolate>}
        />
        {pushPublicKey ? (
          <SettingsRow
            label={ui("owner.notifications", locale)}
            onClick={() => setSheet("notifications")}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title={ui("owner.account", locale)}>
        <SettingsRow
          label={ui("owner.identifier", locale)}
          onClick={() => setSheet("account")}
          value={<LtrIsolate>{identifier}</LtrIsolate>}
        />
      </SettingsSection>

      <BottomSheet open={sheet !== null} onOpenChange={(next) => { if (!next) setSheet(null); }}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          {sheet === "rate" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.rate", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody className="flex flex-col gap-4">
                <p className="type-secondary">
                  {rateGrouped ? (
                    <Figure className="type-title">{rateGrouped}</Figure>
                  ) : (
                    ui("owner.noRate", locale)
                  )}
                </p>
                {changedLabel ? (
                  <p className="type-secondary">
                    {ui("owner.rateLastChanged", locale)}
                    {" · "}
                    <RelativeWhen text={changedLabel} />
                  </p>
                ) : null}
                <form action={submitSetExchangeRate} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lbpPerUsd">{ui("owner.newRate", locale)}</Label>
                    <LbpInput id="lbpPerUsd" name="lbpPerUsd" required defaultValue={rateDigits ?? ""} className="font-mono" />
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
                <form action={submitSetBookingRules} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cancellationWindowHours">
                      {ui("owner.cancelWindow", locale)}
                    </Label>
                    <Input
                      id="cancellationWindowHours"
                      dir="ltr"
                      type="text"
                      name="cancellationWindowHours"
                      required
                      inputMode="numeric"
                      defaultValue={String(cancellationWindowHours)}
                      className="font-mono"
                    />
                  </div>
                  <PercentField
                    name="lateCancellationFeePercent"
                    label={ui("owner.lateFee", locale)}
                    current={lateCancellationFeePercent}
                  />
                  <PercentField
                    name="noShowFeePercent"
                    label={ui("owner.noShowFeeSetting", locale)}
                    current={noShowFeePercent}
                  />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dayStartHour">{ui("owner.dayStartLabel", locale)}</Label>
                    <SelectField
                      id="dayStartHour"
                      name="dayStartHour"
                      defaultValue={String(dayStartHour)}
                      onValueChange={setDayStart}
                      options={[0, 1, 2, 3, 4, 5, 6].map((hour) => ({
                        value: String(hour),
                        label: hour === 0 ? ui("owner.dayStartMidnight", locale) : dayStartClock(hour, locale),
                      }))}
                    />
                    {riskyDayStartHours.includes(Number(dayStart)) ? (
                      <p role="status" className="type-secondary text-owed">
                        {ui("owner.dayStartWarning", locale)}
                      </p>
                    ) : null}
                    <p className="type-caption">{ui("owner.dayStartNote", locale)}</p>
                  </div>
                  <label className="flex items-start gap-3 type-body">
                    <input
                      type="checkbox"
                      name="perPlayerSplitEnabled"
                      value="true"
                      defaultChecked={perPlayerSplitEnabled}
                      className="mt-1 size-4 shrink-0"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="type-body">{ui("owner.splitSetting", locale)}</span>
                      <span className="type-caption">
                        {ui("owner.splitSettingHelp", locale)}
                      </span>
                    </span>
                  </label>
                  <SubmitButton className="w-full">
                    {ui("owner.saveRules", locale)}
                  </SubmitButton>
                </form>
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "public" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.publicPage", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody>
                <ShareCard locale={locale} tenantName={tenantName} publicUrl={publicUrl} />
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "language" ? (
            <>
              <BottomSheetHeader>
                <BottomSheetTitle>{ui("owner.language", locale)}</BottomSheetTitle>
              </BottomSheetHeader>
              <BottomSheetBody>
                <SettingsSection>
                  {(["ar", "en"] as const).map((choice) => (
                    <SettingsRow
                      key={choice}
                      selected={locale === choice}
                      onClick={() => chooseLocale(choice)}
                      label={ui(choice === "en" ? "public.langEnglish" : "public.langArabic", locale)}
                    />
                  ))}
                </SettingsSection>
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
              <BottomSheetBody>
                <SettingsSection>
                  {(["h23", "h12"] as const).map((choice) => (
                    <SettingsRow
                      key={choice}
                      selected={timeDisplay === choice}
                      onClick={() => chooseTime(choice)}
                      label={
                        <LtrIsolate>
                          {ui(choice === "h12" ? "owner.timeDisplayH12" : "owner.timeDisplayH23", locale)}
                        </LtrIsolate>
                      }
                    />
                  ))}
                </SettingsSection>
              </BottomSheetBody>
            </>
          ) : null}

          {sheet === "notifications" && pushPublicKey ? (
            <NotificationsSheetContent locale={locale} publicKey={pushPublicKey} />
          ) : null}

          {sheet === "account" ? (
            <AccountSheetContent locale={locale} identifier={identifier} slug={slug} />
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
