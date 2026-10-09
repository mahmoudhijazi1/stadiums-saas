"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatLbpAmount, formatUsdAmount } from "@/lib/money-display";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { isValidUsd, MoneyInput } from "../settings/pitches/money-input";
import { SettingsRow, SettingsSection } from "../settings-list";
import { submitArchiveProduct, submitCreateProduct, submitUpdateProduct } from "./actions";

/** The price is a USD amount ("1.50") or whole pounds ("20000"), in the item's own currency. */
export type CatalogItem = { id: string; name: string; currency: "USD" | "LBP"; price: string };

/**
 * The shop catalog: a list ordered by what sold most in the last 30 days, and a sheet with a name, a
 * currency switch ("ل.ل | $", pounds by default) and a price to add or edit. Archive instead of
 * delete. Names stay as written. A price is in one currency: an item priced in pounds is sold in
 * pounds, whatever the rate does.
 */
export function ShopCatalog({ items, locale }: { items: CatalogItem[]; locale: UiLocale }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "LBP">("LBP");
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, startTransition] = useTransition();

  function open(target: CatalogItem | "new") {
    setEditing(target);
    setName(target === "new" ? "" : target.name);
    setPrice(target === "new" ? "" : target.price);
    setCurrency(target === "new" ? "LBP" : target.currency);
    setError(null);
    setConfirmArchive(false);
  }

  function finish(result: { ok: true } | { error: string }) {
    if ("error" in result) {
      setError(errorMessage(result.error, locale));
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function save() {
    if (!editing) return;
    const input = currency === "LBP" ? { name, priceLbp: price.trim() } : { name, priceUsd: price };
    startTransition(async () => {
      finish(
        editing === "new" ? await submitCreateProduct(input) : await submitUpdateProduct(editing.id, input),
      );
    });
  }

  function archive() {
    if (!editing || editing === "new") return;
    startTransition(async () => finish(await submitArchiveProduct(editing.id)));
  }

  const priceOk = currency === "LBP" ? /^[1-9]\d*$/.test(price.trim()) : isValidUsd(price) && Number(price) > 0;
  const canSave = name.trim().length > 0 && priceOk;

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" className="w-full gap-2" onClick={() => open("new")}>
        <Plus aria-hidden className="size-4" />
        {ui("owner.shopAdd", locale)}
      </Button>

      {items.length === 0 ? (
        <p className="type-secondary text-center">{ui("owner.shopEmpty", locale)}</p>
      ) : (
        <SettingsSection>
          {items.map((item) => (
            <SettingsRow
              key={item.id}
              label={<bdi>{item.name}</bdi>}
              value={<LtrIsolate>{item.currency === "LBP" ? formatLbpAmount(item.price, locale) : formatUsdAmount(item.price)}</LtrIsolate>}
              onClick={() => open(item)}
            />
          ))}
        </SettingsSection>
      )}

      <BottomSheet open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>
              {editing === "new" ? ui("owner.shopAdd", locale) : ui("owner.shopEdit", locale)}
            </BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4 pb-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-name">{ui("owner.shopName", locale)}</Label>
              <Input
                id="product-name"
                maxLength={60}
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-price">{ui("owner.shopPrice", locale)}</Label>
              <div role="group" aria-label={ui("owner.shopCurrency", locale)} className="inline-flex w-fit rounded-full border bg-card p-0.5">
                {(["LBP", "USD"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={currency === choice}
                    onClick={() => {
                      setCurrency(choice);
                      setPrice("");
                    }}
                    className={cn(
                      "inline-flex min-h-10 min-w-12 items-center justify-center rounded-full px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      currency === choice ? "bg-selected text-selected-ink" : "text-muted-foreground",
                    )}
                  >
                    {choice === "LBP" ? "ل.ل" : "$"}
                  </button>
                ))}
              </div>
              {currency === "LBP" ? (
                <LbpInput id="product-price" value={price} onValueChange={setPrice} className="font-mono" />
              ) : (
                <MoneyInput id="product-price" value={price} onChange={setPrice} invalid={price !== "" && !isValidUsd(price)} />
              )}
              {editing !== "new" ? (
                <p className="type-caption">{ui("owner.shopPriceNote", locale)}</p>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="type-secondary text-owed">
                {error}
              </p>
            ) : null}
            <Button type="button" className="w-full" onClick={save} disabled={pending || !canSave}>
              {ui("owner.shopSave", locale)}
            </Button>
            {editing !== "new" && editing !== null ? (
              confirmArchive ? (
                <div className="flex flex-col gap-2">
                  <p className="type-secondary">{ui("owner.shopArchiveAsk", locale)}</p>
                  <Button type="button" variant="outline" className="w-full text-owed" onClick={archive} disabled={pending}>
                    {ui("owner.shopArchiveConfirm", locale)}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setConfirmArchive(false)}>
                    {ui("owner.notNow", locale)}
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setConfirmArchive(true)}>
                  {ui("owner.shopArchive", locale)}
                </Button>
              )
            ) : null}
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
