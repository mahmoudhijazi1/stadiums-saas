"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ItemTiles, QTY_MAX, partsOf, type SellItem } from "@/modules/shop/ui/item-tiles";
import type { WalkInSaleInput, WalkInSaleResult } from "@/modules/shop/ui/sell-screen";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/copy/errors";
import type { UiLocale } from "@/lib/locale";
import { formatParts } from "@/lib/format/money";
import { changeDescription, itemsAddedToast, soldToast, ui } from "@/lib/copy";
import { cn } from "cn";
import type { ItemsResult } from "@/modules/booking/ui/action-types";
import { NewTabStep, PayNowStep, TabStep, payerInput, type Payer } from "@/modules/booking/ui/add-items-steps";

/** Who already has a tab on this booking (the booker's included, if she has one). */
export type TabPayer = { personId: string | null; name: string };

type Step = "items" | "way" | "pay" | "tab" | "new";

/**
 * "Add items" on a game: items first, then three ways out.
 * 1. Items: the tiles (most sold first) and a bar with the total per currency and one "Next".
 * 2. Two large buttons: "Pay now" (a walk-in sale on the usual collect screen: no name, no phone) and
 *    "On a tab".
 * 3. "On a tab": the booker (selected), everyone who already has a tab on THIS game, then "New", which
 *    opens a full-screen step with one field (a name or nickname) and the phone behind "+ Phone".
 * Prices never come from here: only ids and quantities go to the server. The 60-minute window is the
 * server's (the tab path) and the caller's (this sheet only opens inside it).
 */
export function AddItemsSheet({
  open,
  onClose,
  bookingId,
  bookerName,
  tabPayers,
  bookerPersonId,
  products,
  lbpPerUsd,
  locale,
  onDone,
  submitAddBookingItems,
  submitWalkInSale,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  bookerName: string;
  bookerPersonId: string;
  tabPayers: TabPayer[];
  products: SellItem[];
  lbpPerUsd: string | null;
  locale: UiLocale;
  onDone: () => void;
  submitAddBookingItems: (input: unknown) => Promise<ItemsResult>;
  submitWalkInSale: (input: WalkInSaleInput) => Promise<WalkInSaleResult>;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>("items");
  const [payer, setPayer] = useState<Payer>({ kind: "game" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = products.filter((item) => (counts[item.id] ?? 0) > 0).map((item) => ({ productId: item.id, qty: counts[item.id]! }));
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = partsOf(products, counts);
  const totalText = formatParts(total, locale);

  // The booker is the first button; here are the others that already have a tab on this game.
  const others: Payer[] = tabPayers
    .filter((tab) => tab.personId === null || tab.personId !== bookerPersonId)
    .map((tab) =>
      tab.personId
        ? ({ kind: "person", personId: tab.personId, name: tab.name } as const)
        : ({ kind: "name", name: tab.name, phone: "" } as const),
    );

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function finish() {
    setCounts({});
    setPayer({ kind: "game" });
    setStep("items");
    onClose();
    onDone();
  }

  function change(id: string, delta: number) {
    setCounts((current) => ({ ...current, [id]: Math.min(QTY_MAX, Math.max(0, (current[id] ?? 0) + delta)) }));
  }

  function addToTab(chosen: Payer) {
    setError(null);
    startTransition(async () => {
      const result = await submitAddBookingItems({ bookingId, lines, payer: payerInput(chosen) });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      toast.success(itemsAddedToast(result.itemCount ?? itemCount, totalText, locale));
      finish();
    });
  }

  function payNow(usdAmount: string, lbpAmount: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitWalkInSale({ lines, usdAmount, lbpAmount });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      toast.success(soldToast(result.itemCount, formatParts({ lbp: result.totalLbp, usd: result.totalUsdPart }, locale), locale), {
        description: changeDescription({ lbp: result.changeLbp, usd: result.changeUsd }, locale, lbpPerUsd),
        duration: 8000,
      });
      finish();
    });
  }

  const back: Partial<Record<Step, Step>> = { way: "items", pay: "way", tab: "way", new: "tab" };
  const BackArrow = locale === "ar" ? ArrowRight : ArrowLeft;

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent
        closeLabel={ui("dialog.close", locale)}
        className={cn(step === "new" && "max-lg:h-dvh max-lg:max-h-dvh max-lg:rounded-none")}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>{ui(step === "tab" || step === "new" ? "owner.itemsOnTab" : "owner.addItems", locale)}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="flex flex-col gap-4 pb-4 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden">
          {back[step] ? (
            <button
              type="button"
              onClick={() => go(back[step]!)}
              className="inline-flex min-h-11 w-fit items-center gap-1 type-label text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <BackArrow aria-hidden className="size-4 shrink-0" />
              {ui("owner.itemsBack", locale)}
            </button>
          ) : null}
          {step !== "items" && step !== "new" ? (
            <p className="type-strong">
              {ui("owner.sellTotal", locale)}: <LtrIsolate>{totalText}</LtrIsolate>
            </p>
          ) : null}

          {step === "items" ? (
            <ItemTiles items={products} counts={counts} onChange={change} locale={locale} rateKnown={lbpPerUsd !== null} />
          ) : null}

          {step === "way" ? (
            <div className="flex flex-col gap-3">
              <Button type="button" size="lg" className="min-h-16 w-full text-base" onClick={() => go("pay")}>
                {ui("owner.itemsPayNow", locale)}
              </Button>
              <Button type="button" size="lg" variant="outline" className="min-h-16 w-full text-base" onClick={() => go("tab")}>
                {ui("owner.itemsOnTab", locale)}
              </Button>
            </div>
          ) : null}

          {step === "pay" ? (
            <PayNowStep parts={total} lbpPerUsd={lbpPerUsd} locale={locale} pending={pending} error={error} onPay={payNow} />
          ) : null}

          {step === "tab" ? (
            <TabStep
              bookerName={bookerName}
              others={others}
              payer={payer}
              onPick={(next) => {
                setError(null);
                setPayer(next);
              }}
              onNew={() => go("new")}
              locale={locale}
              pending={pending}
              error={error}
              onAdd={() => addToTab(payer)}
            />
          ) : null}

          {step === "new" ? (
            <NewTabStep
              locale={locale}
              pending={pending}
              error={error}
              onAdd={(name, phone) => addToTab({ kind: "name", name, phone })}
            />
          ) : null}

          {step === "items" && error ? (
            <p role="alert" className="type-secondary text-owed">
              {error}
            </p>
          ) : null}
        </BottomSheetBody>
        {step === "items" ? (
          <div className="shrink-0 px-4 pt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="type-caption">{ui("owner.sellTotal", locale)}</span>
              <span className="type-strong">
                <LtrIsolate>{totalText}</LtrIsolate>
              </span>
            </div>
            <Button type="button" className="w-full" disabled={itemCount === 0} onClick={() => go("way")}>
              {ui("owner.itemsNext", locale)}
              <ArrowRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
            </Button>
          </div>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}
