"use client";

import Link from "next/link";
import { submitSetGameCurrency } from "@/app/owner/(app)/more/settings/actions";
import { BottomSheetBody, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import type { GameCurrencySetting } from "@/modules/stadium/application/game-currency";

/** "USD" or the pound sign as the owner reads it. */
export function currencyName(currency: "USD" | "LBP", locale: UiLocale): string {
  return currency === "LBP" ? ui("owner.lbp", locale) : "USD";
}

/**
 * The "Game prices in" sheet (DR-007 decision 1): a confirm for the other currency, or, when a pitch
 * has no price in it, the list of those pitches with a link to each editor and no confirm button. The
 * use case refuses the switch too; this only avoids offering what would be refused.
 */
export function GameCurrencySheetContent({ setting, locale }: { setting: GameCurrencySetting; locale: UiLocale }) {
  const target = currencyName(setting.target, locale);
  return (
    <>
      <BottomSheetHeader>
        <BottomSheetTitle>{ui("owner.gamePricesIn", locale)}</BottomSheetTitle>
      </BottomSheetHeader>
      <BottomSheetBody className="flex flex-col gap-4">
        {setting.missing.length > 0 ? (
          <>
            <p className="type-body">{ui("owner.gameCurrencyMissing", locale).replace("{currency}", target)}</p>
            <ul className="flex flex-col gap-2">
              {setting.missing.map((pitch) => (
                <li key={pitch.id}>
                  <Link
                    href={`/owner/more/settings/pitches/${pitch.id}?currency=${setting.target}&returnTo=game-currency`}
                    className="flex min-h-11 items-center rounded-lg bg-muted px-3 type-strong outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {pitch.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form action={submitSetGameCurrency} className="flex flex-col gap-4">
            <input type="hidden" name="currency" value={setting.target} />
            <p className="type-body">{ui("owner.gameCurrencyConfirm", locale).replace("{currency}", target)}</p>
            <SubmitButton className="w-full">{ui("owner.gameCurrencySwitch", locale).replace("{currency}", target)}</SubmitButton>
          </form>
        )}
      </BottomSheetBody>
    </>
  );
}
