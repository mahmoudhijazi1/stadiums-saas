"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UiLocale } from "@/lib/locale";
import { errorMessage } from "@/lib/error-messages";
import { ui } from "@/lib/ui-copy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "cn";
import { scheduleFromHoursGroups, type HoursGroup } from "@/modules/venue/domain/daily-schedule";
import {
  hoursToRows,
  priceCardsToRules,
  rowsToHours,
  rulesToPriceCards,
} from "@/modules/venue/domain/pitch-form-model";
import type { PitchPriceRule } from "@/modules/venue/schemas/pitch-draft";
import { HoursRows } from "./hours-rows";
import { isValidUsd, MoneyInput } from "./money-input";
import { PreviewCard } from "./preview-card";
import { PriceCards, type PriceCard } from "./price-cards";

export type PitchFormDefaults = {
  name: string;
  hoursGroups: HoursGroup[];
  slotDurationMinutes: string;
  defaultPlayerCount: string;
  defaultPriceUsd: string;
  priceRules: PitchPriceRule[];
};

const LENGTHS = ["60", "90", "120"] as const;

/**
 * Create / edit pitch for an owner who is not technical: seven day rows, a game length,
 * one price, optional different prices on some days, and a live preview of the games a
 * player would see. It submits the same fields as before (hoursGroupsJson,
 * priceRulesJson, ...), so the server validates exactly what it did.
 * Pending hours-cover still uses a second-submit checkbox.
 */
export function PitchDraftForm({
  locale,
  action,
  pitchId,
  defaults,
  showPending,
  splitEnabled,
  hourCycle,
  dayStartHour,
}: {
  locale: UiLocale;
  action: (formData: FormData) => Promise<void>;
  pitchId?: string;
  defaults: PitchFormDefaults;
  showPending: boolean;
  /** Off: the field is hidden but its stored value still posts (hidden input). */
  splitEnabled: boolean;
  hourCycle: "h12" | "h23";
  dayStartHour: number;
}) {
  const initial = useMemo(() => rulesToPriceCards(defaults.priceRules), [defaults.priceRules]);
  const [name, setName] = useState(defaults.name);
  const [rows, setRows] = useState(() => hoursToRows(defaults.hoursGroups));
  const [duration, setDuration] = useState(defaults.slotDurationMinutes);
  const [otherLength, setOtherLength] = useState(
    !(LENGTHS as readonly string[]).includes(defaults.slotDurationMinutes),
  );
  const [players, setPlayers] = useState(defaults.defaultPlayerCount);
  const [price, setPrice] = useState(defaults.defaultPriceUsd);
  const [cards, setCards] = useState<PriceCard[]>(() =>
    initial.cards.map((card, index) => ({ key: `c${index}`, ...card })),
  );

  const groups = rowsToHours(rows);
  const completeCards = cards.filter((card) => card.days.length > 0 && isValidUsd(card.priceUsd));
  const priceRules = priceCardsToRules(completeCards, initial.timed);
  const durationNumber = /^\d+$/.test(duration) ? Number(duration) : 0;
  const cardsIncomplete = cards.some((card) => card.days.length > 0 && !isValidUsd(card.priceUsd));
  const canSave =
    name.trim().length > 0 && groups.length > 0 && durationNumber > 0 && isValidUsd(price) && !cardsIncomplete;

  const groupsJson = JSON.stringify(groups);
  const rulesJson = JSON.stringify(priceRules);
  const config = useMemo(() => {
    if (durationNumber <= 0 || !isValidUsd(price)) return null;
    try {
      return scheduleFromHoursGroups({
        groups: JSON.parse(groupsJson) as HoursGroup[],
        slotDurationMinutes: durationNumber,
        defaultPriceUsd: price,
        priceRules: JSON.parse(rulesJson) as PitchPriceRule[],
      });
    } catch {
      return null;
    }
  }, [groupsJson, durationNumber, price, rulesJson]);

  // Dirty = anything differs from what the form opened with.
  const snapshot = JSON.stringify([name, groupsJson, duration, players, price, rulesJson]);
  const [opened] = useState(snapshot);
  const dirty = snapshot !== opened;
  const submitting = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (submitting.current) return;
      event.preventDefault();
    };
    // In-app links (Back, tabs) are client navigations, which beforeunload does not see.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor || submitting.current) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || (anchor as HTMLAnchorElement).target === "_blank") return;
      if (!window.confirm(ui("owner.pitchLeaveConfirm", locale))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, locale]);

  return (
    <form
      action={action}
      onSubmit={() => {
        submitting.current = true;
      }}
      className="flex flex-col gap-6 pb-28"
    >
      {pitchId ? <input type="hidden" name="pitchId" value={pitchId} /> : null}
      <input type="hidden" name="hoursGroupsJson" value={groupsJson} />
      <input type="hidden" name="priceRulesJson" value={rulesJson} />
      <input type="hidden" name="slotDurationMinutes" value={duration} />
      <input type="hidden" name="defaultPriceUsd" value={price} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="pitch-name">{ui("owner.pitchName", locale)}</Label>
        <Input
          id="pitch-name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <HoursRows locale={locale} rows={rows} onChange={setRows} hourCycle={hourCycle} dayStartHour={dayStartHour} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-muted-foreground">{ui("owner.pitchGameLength", locale)}</legend>
        <div role="group" className="grid grid-cols-4 gap-2">
          {LENGTHS.map((minutes) => {
            const on = !otherLength && duration === minutes;
            return (
              <button
                key={minutes}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setOtherLength(false);
                  setDuration(minutes);
                }}
                className={cn(
                  "min-h-11 rounded-lg border px-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on ? "border-transparent bg-selected font-semibold text-selected-ink" : "bg-card",
                )}
              >
                <span dir="ltr">{minutes}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={otherLength}
            onClick={() => setOtherLength(true)}
            className={cn(
              "min-h-11 rounded-lg border px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              otherLength ? "border-transparent bg-selected font-semibold text-selected-ink" : "bg-card",
            )}
          >
            {ui("owner.pitchOtherLength", locale)}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{ui("owner.pitchMinutesFull", locale)}</p>
        {otherLength ? (
          <div className="flex items-center gap-2" dir="ltr">
            <Input
              type="text"
              inputMode="numeric"
              aria-label={ui("owner.pitchDuration", locale)}
              value={duration}
              onChange={(event) => setDuration(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="max-w-28 font-semibold"
            />
            <span className="text-sm text-muted-foreground">{ui("owner.pitchMinutesFull", locale)}</span>
          </div>
        ) : null}
      </fieldset>

      {splitEnabled ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pitch-players">{ui("owner.pitchPlayers", locale)}</Label>
          <Input
            id="pitch-players"
            type="number"
            name="defaultPlayerCount"
            required
            min={1}
            max={30}
            step={1}
            inputMode="numeric"
            value={players}
            onChange={(event) => setPlayers(event.target.value)}
            className="font-semibold"
          />
        </div>
      ) : (
        <input type="hidden" name="defaultPlayerCount" value={players} />
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="pitch-price">{ui("owner.pitchPrice", locale)}</Label>
        <MoneyInput id="pitch-price" value={price} onChange={setPrice} invalid={price !== "" && !isValidUsd(price)} />
      </div>

      <PriceCards locale={locale} cards={cards} onChange={setCards} timed={initial.timed} hourCycle={hourCycle} />

      <PreviewCard locale={locale} config={config} rows={rows} hourCycle={hourCycle} slotMinutes={durationNumber} />

      {showPending ? (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <p className="text-sm text-muted-foreground">{errorMessage("venue.hours_pending", locale)}</p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirmPending" value="true" className="mt-1 size-4 shrink-0" />
            <span>{ui("owner.pitchConfirmPending", locale)}</span>
          </label>
        </fieldset>
      ) : null}

      {/* Sticky save bar: only when something changed (always on a new pitch), above the
          floating bottom nav and its safe-area inset. One primary button. */}
      {dirty || !pitchId ? (
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-lg px-3 lg:bottom-4">
          <div className="rounded-2xl border bg-card p-2 shadow-lg">
            <SubmitButton className="w-full" disabled={!canSave}>
              {pitchId ? ui("owner.saveChanges", locale) : ui("owner.pitchCreate", locale)}
            </SubmitButton>
          </div>
        </div>
      ) : null}
    </form>
  );
}
