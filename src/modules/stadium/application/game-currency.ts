import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getCurrentTenantId, safeTenantId } from "@/lib/tenant-context";
import { parseTenantSettings, type GamePriceCurrency } from "@/lib/tenant-settings";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SETTINGS_GAME_CURRENCY, can } from "@/modules/access/domain/can";
import {
  previewGameCurrencyOf,
  switchGameCurrencyOf,
  type PitchRef,
} from "@/modules/platform/application/set-game-currency";
import { readTenantProfile } from "@/modules/platform/application/tenant-profile";
import { otherGameCurrency, parseGameCurrencyForm } from "@/modules/stadium/domain/game-currency";

export type GameCurrencySetting = {
  current: GamePriceCurrency;
  /** The currency the confirm sheet offers (the other one). */
  target: GamePriceCurrency;
  /** Pitches with no full set of prices in `target`: when any, the switch is refused. */
  missing: PitchRef[];
};

/** Owner only (`settings.game_currency`): staff can hold settings.manage but never this. */
async function requireOwner() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SETTINGS_GAME_CURRENCY)) {
    throw new DomainError("access.not_allowed");
  }
  return membership;
}

/** What the "Game prices in" row and its confirm sheet show now. Owner only. */
export async function loadGameCurrencySetting(): Promise<GameCurrencySetting> {
  await requireOwner();
  const tenantId = await getCurrentTenantId();
  const current = parseTenantSettings((await readTenantProfile(tenantId)).settings).gamePriceCurrency;
  const target = otherGameCurrency(current);
  const preview = await previewGameCurrencyOf(tenantId, target);
  return { current, target, missing: preview.missing };
}

/**
 * Switch what new games are priced in (DR-007 decision 1). Owner only. The tenant is the request's, never
 * the input's. Refused here, not only in the form, when any pitch has no full set of prices in the new
 * currency (`settings.game_currency_missing_prices`, nothing changes) or when the value is the one already
 * set. Only the setting changes: existing games keep their currency. One audit row
 * `tenant.game_currency` (from, to, the acting membership), written with the change.
 */
export async function setOwnGameCurrency(raw: unknown): Promise<void> {
  const membership = await requireOwner();
  const { currency } = parseGameCurrencyForm(raw);
  const tenantId = await getCurrentTenantId();
  try {
    await switchGameCurrencyOf({
      tenantId,
      currency,
      actor: `owner:${membership.userId}`,
      membershipId: membership.membershipId,
    });
    logger.info("Game price currency changed", undefined, { useCase: "setOwnGameCurrency", tenantId: await safeTenantId() });
  } catch (error) {
    await rethrowUnexpected(error, "Set game currency failed", "setOwnGameCurrency");
  }
}
