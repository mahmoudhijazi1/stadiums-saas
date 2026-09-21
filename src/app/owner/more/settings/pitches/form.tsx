import type { UiLocale } from "@/lib/locale";
import { errorMessage } from "@/lib/error-messages";
import { ui } from "@/lib/ui-copy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { HoursGroup } from "@/modules/venue/domain/daily-schedule";
import type { PitchPriceRule } from "@/modules/venue/schemas/pitch-draft";
import { HoursGroupRows } from "./hours-groups";
import { PriceRuleRows } from "./price-rules";

export type PitchFormDefaults = {
  name: string;
  hoursGroups: HoursGroup[];
  slotDurationMinutes: string;
  defaultPriceUsd: string;
  priceRules: PitchPriceRule[];
};

/**
 * Create/edit pitch: hours groups + day price overrides.
 * Pending hours-cover still uses a second-submit checkbox.
 */
export function PitchDraftForm({
  locale,
  action,
  pitchId,
  defaults,
  showPending,
}: {
  locale: UiLocale;
  action: (formData: FormData) => Promise<void>;
  pitchId?: string;
  defaults: PitchFormDefaults;
  showPending: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {pitchId ? <input type="hidden" name="pitchId" value={pitchId} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="pitch-name">{ui("owner.pitchName", locale)}</Label>
        <Input
          id="pitch-name"
          name="name"
          required
          maxLength={80}
          defaultValue={defaults.name}
        />
      </div>

      <HoursGroupRows
        key={JSON.stringify(defaults.hoursGroups)}
        locale={locale}
        initial={defaults.hoursGroups}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="pitch-duration">
          {ui("owner.pitchDuration", locale)}
        </Label>
        <Input
          id="pitch-duration"
          type="number"
          name="slotDurationMinutes"
          required
          min={1}
          step={1}
          inputMode="numeric"
          defaultValue={defaults.slotDurationMinutes}
          className="font-mono"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pitch-price">{ui("owner.pitchPrice", locale)}</Label>
        <Input
          id="pitch-price"
          type="text"
          name="defaultPriceUsd"
          required
          inputMode="decimal"
          defaultValue={defaults.defaultPriceUsd}
          className="font-mono"
        />
      </div>

      <PriceRuleRows
        key={JSON.stringify(defaults.priceRules)}
        locale={locale}
        initial={defaults.priceRules}
      />

      {showPending ? (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <p className="text-sm text-muted-foreground">
            {errorMessage("venue.hours_pending", locale)}
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="confirmPending"
              value="true"
              className="mt-1 size-4 shrink-0"
            />
            <span>{ui("owner.pitchConfirmPending", locale)}</span>
          </label>
        </fieldset>
      ) : null}

      <SubmitButton className="w-full">
        {pitchId
          ? ui("owner.pitchSave", locale)
          : ui("owner.pitchCreate", locale)}
      </SubmitButton>
    </form>
  );
}
