"use client";

import { useState } from "react";
import { accentPreviewCss } from "@/lib/accent-css";
import { BRAND_PRESETS, type BrandPresetKey } from "@/lib/brand-presets";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { sanitizePhoneInput } from "@/modules/people/domain/phone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "cn";

export type StadiumFormDefaults = {
  name: string;
  address: string;
  mapLink: string;
  phone: string;
  whatsappSame: boolean;
  whatsapp: string;
  brandPreset: BrandPresetKey;
};

/** The first letter of the name on the chosen colour: what the generated logo will look like. */
function firstSymbol(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toUpperCase() : "•";
}

export function StadiumForm({
  action,
  defaults,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  defaults: StadiumFormDefaults;
  locale: UiLocale;
}) {
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [whatsapp, setWhatsapp] = useState(defaults.whatsapp);
  const [same, setSame] = useState(defaults.whatsappSame);
  const [preset, setPreset] = useState<BrandPresetKey>(defaults.brandPreset);
  const colours = BRAND_PRESETS.find((candidate) => candidate.key === preset) ?? BRAND_PRESETS[0];

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="type-secondary text-ink-muted">{ui("owner.stadiumInstallHint", locale)}</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-name">{ui("owner.stadiumName", locale)}</Label>
        <Input
          id="stadium-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-address">{ui("owner.stadiumAddress", locale)}</Label>
        <Input id="stadium-address" name="address" defaultValue={defaults.address} maxLength={120} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-map">{ui("owner.stadiumMapLink", locale)}</Label>
        <Input
          id="stadium-map"
          name="mapLink"
          type="url"
          defaultValue={defaults.mapLink}
          maxLength={300}
          placeholder="https://maps.app.goo.gl/…"
          autoComplete="off"
        />
        <p className="type-secondary text-ink-muted">{ui("owner.stadiumMapHint", locale)}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stadium-phone">{ui("owner.stadiumPhone", locale)}</Label>
        <Input
          id="stadium-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(sanitizePhoneInput(event.target.value))}
          maxLength={20}
          autoComplete="off"
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={same}
        onClick={() => setSame((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 type-body text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>{ui("owner.stadiumWhatsappSame", locale)}</span>
        <span
          aria-hidden
          className={cn("flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors", same ? "bg-selected" : "bg-surface-2")}
        >
          <span
            className={cn(
              "size-5 rounded-full bg-card shadow-xs transition-transform motion-reduce:transition-none",
              same && "translate-x-5 rtl:-translate-x-5",
            )}
          />
        </span>
      </button>
      {same ? <input type="hidden" name="whatsappSame" value="true" /> : null}
      {same ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="stadium-whatsapp">{ui("owner.stadiumWhatsapp", locale)}</Label>
          <Input
            id="stadium-whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(sanitizePhoneInput(event.target.value))}
            maxLength={20}
            autoComplete="off"
          />
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="type-label">{ui("owner.stadiumColour", locale)}</legend>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-xl type-title"
            style={{ backgroundColor: colours.light.fill, color: colours.light.onFill }}
          >
            {firstSymbol(name)}
          </span>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {BRAND_PRESETS.map((option) => (
              <label key={option.key} className="cursor-pointer">
                <input
                  type="radio"
                  name="brandPreset"
                  value={option.key}
                  checked={preset === option.key}
                  aria-label={ui(`owner.brand.${option.key}`, locale)}
                  onChange={() => setPreset(option.key)}
                  className="peer sr-only"
                />
                <span
                  className="block size-11 rounded-full border-2 border-transparent peer-checked:border-ink peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
                  style={{ backgroundColor: option.light.fill }}
                  title={ui(`owner.brand.${option.key}`, locale)}
                >
                  <span className="sr-only">{ui(`owner.brand.${option.key}`, locale)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="accent-preview flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
          <style>{accentPreviewCss(preset)}</style>
          <span className="pv-button inline-flex min-h-11 items-center rounded-full px-5 type-button">
            {ui("owner.accentPreviewButton", locale)}
          </span>
          <span className="pv-pill inline-flex min-h-9 items-center rounded-full bg-inverse px-4 type-label text-inverse-ink">
            {ui("owner.accentPreviewTab", locale)}
          </span>
          <span className="pv-link type-body font-medium underline underline-offset-4">
            {ui("owner.accentPreviewLink", locale)}
          </span>
        </div>
        <p className="type-secondary text-ink-muted">{ui("owner.stadiumColourNote", locale)}</p>
      </fieldset>

      <SubmitButton className="min-h-11">{ui("owner.stadiumSave", locale)}</SubmitButton>
    </form>
  );
}
