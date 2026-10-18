import { DomainError } from "@/lib/errors";
import {
  GAME_PRICE_CURRENCIES,
  mergeGamePriceCurrency,
  parseTenantSettings,
  type GamePriceCurrency,
} from "@/lib/tenant-settings";
import { requireActor } from "@/modules/platform/domain/inputs";
import {
  findTenantBySlug,
  findTenantNameAndSettings,
  listTenantPitchConfigs,
  platformTransaction,
  updateTenantSettings,
  writeAudit,
} from "@/modules/platform/infrastructure/platform-store";
import { hasPricesIn, parseScheduleConfig } from "@/modules/venue/domain/schedule-config";

/** "USD" or "LBP", exactly; anything else is refused before any prompt. */
export function parseGameCurrency(value: string | undefined): GamePriceCurrency {
  const found = GAME_PRICE_CURRENCIES.find((currency) => currency === value);
  if (!found) throw new DomainError("platform.currency_invalid");
  return found;
}

export type GameCurrencyPreview = {
  current: GamePriceCurrency;
  /** Names of the pitches missing a price (the default or a rule) in the new currency. */
  pitchesWithoutPrices: string[];
};

/**
 * What switching a stadium's game currency would meet (DR-007): the current value and the pitches that
 * have no full set of prices in `currency`. A pitch whose schedule cannot be read counts as missing.
 * Read only.
 */
export async function previewGameCurrency(input: {
  slug: string;
  currency: GamePriceCurrency;
}): Promise<GameCurrencyPreview> {
  const tenant = await findTenantBySlug(input.slug);
  if (!tenant) throw new DomainError("platform.tenant_not_found");
  const [profile, pitches] = await platformTransaction(async (tx) =>
    Promise.all([findTenantNameAndSettings(tx, tenant.id), listTenantPitchConfigs(tx, tenant.id)]),
  );
  const pitchesWithoutPrices = pitches
    .filter((pitch) => {
      try {
        return !hasPricesIn(parseScheduleConfig(pitch.scheduleConfig), input.currency);
      } catch {
        return true;
      }
    })
    .map((pitch) => pitch.name);
  return { current: parseTenantSettings(profile.settings).gamePriceCurrency, pitchesWithoutPrices };
}

/**
 * Set "game prices in USD or LBP" for one stadium (DR-007 decision 1). Only the setting changes: no
 * booking, pitch or payment is touched, so existing games keep their currency. One audit row
 * `tenant.set_game_currency` with the old and new value. The same value again is refused.
 */
export async function setGameCurrency(input: {
  slug: string;
  currency: GamePriceCurrency;
  actor: string;
}): Promise<void> {
  const actor = requireActor(input.actor);
  const tenant = await findTenantBySlug(input.slug);
  if (!tenant) throw new DomainError("platform.tenant_not_found");

  await platformTransaction(async (tx) => {
    const { settings } = await findTenantNameAndSettings(tx, tenant.id);
    const from = parseTenantSettings(settings).gamePriceCurrency;
    if (from === input.currency) throw new DomainError("platform.currency_unchanged");
    await updateTenantSettings(tx, tenant.id, mergeGamePriceCurrency(settings, input.currency));
    await writeAudit(tx, {
      action: "tenant.set_game_currency",
      tenantId: tenant.id,
      actor,
      detail: { from, to: input.currency },
    });
  });
}
