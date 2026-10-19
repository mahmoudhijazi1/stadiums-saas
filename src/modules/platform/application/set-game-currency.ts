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

export type PitchRef = { id: string; name: string };

/** The pitches with no full set of prices in `currency`; a schedule that cannot be read counts as missing. */
function pitchesMissingPrice(
  pitches: { id: string; name: string; scheduleConfig: unknown }[],
  currency: GamePriceCurrency,
): PitchRef[] {
  return pitches
    .filter((pitch) => {
      try {
        return !hasPricesIn(parseScheduleConfig(pitch.scheduleConfig), currency);
      } catch {
        return true;
      }
    })
    .map(({ id, name }) => ({ id, name }));
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
  const pitchesWithoutPrices = pitchesMissingPrice(pitches, input.currency).map((pitch) => pitch.name);
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

/**
 * What the owner's own switch would meet (DR-007 decision 1): the current value and the pitches with no
 * full set of prices in `currency`, by id so the sheet can link to each pitch editor. The tenant is the
 * request's, passed by the caller. Read only.
 */
export async function previewGameCurrencyOf(
  tenantId: string,
  currency: GamePriceCurrency,
): Promise<{ current: GamePriceCurrency; missing: PitchRef[] }> {
  const [profile, pitches] = await platformTransaction(async (tx) =>
    Promise.all([findTenantNameAndSettings(tx, tenantId), listTenantPitchConfigs(tx, tenantId)]),
  );
  return { current: parseTenantSettings(profile.settings).gamePriceCurrency, missing: pitchesMissingPrice(pitches, currency) };
}

/**
 * The owner's own switch (DR-007 decision 1). Refused, here and not only in the form, when the stadium
 * already prices in `currency` or when any pitch has no full set of prices in it; nothing changes then.
 * Otherwise only the setting changes (existing games keep their currency) and one audit row
 * `tenant.game_currency` records from, to and the acting membership. Read, check, write and audit are
 * one transaction.
 */
export async function switchGameCurrencyOf(input: {
  tenantId: string;
  currency: GamePriceCurrency;
  actor: string;
  membershipId: string;
}): Promise<void> {
  await platformTransaction(async (tx) => {
    const { settings } = await findTenantNameAndSettings(tx, input.tenantId);
    const from = parseTenantSettings(settings).gamePriceCurrency;
    if (from === input.currency) throw new DomainError("settings.game_currency_unchanged");
    const missing = pitchesMissingPrice(await listTenantPitchConfigs(tx, input.tenantId), input.currency);
    if (missing.length > 0) throw new DomainError("settings.game_currency_missing_prices");
    await updateTenantSettings(tx, input.tenantId, mergeGamePriceCurrency(settings, input.currency));
    await writeAudit(tx, {
      action: "tenant.game_currency",
      tenantId: input.tenantId,
      actor: input.actor,
      detail: { from, to: input.currency, membershipId: input.membershipId },
    });
  });
}
