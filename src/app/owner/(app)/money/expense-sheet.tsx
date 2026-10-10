"use client";

import { useEffect, useState } from "react";
import { orderCategories, rememberCategory } from "@/modules/expense/domain/category-order";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";
import type { LedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { submitRecordExpense } from "./actions";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { TenderBalance } from "@/app/owner/tender-balance";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "cn";

function keepPeriodQuery(period: LedgerPeriodQuery) {
  return (
    <>
      {period.period && !(period.from && period.to) ? (
        <input type="hidden" name="period" value={period.period} />
      ) : null}
      {period.filter !== "all" ? <input type="hidden" name="filter" value={period.filter} /> : null}
      {period.from ? (
        <input type="hidden" name="from" value={period.from} />
      ) : null}
      {period.to ? <input type="hidden" name="to" value={period.to} /> : null}
      {period.view !== "usd" ? (
        <input type="hidden" name="view" value={period.view} />
      ) : null}
      {period.displayRate ? (
        <input type="hidden" name="displayRate" value={period.displayRate} />
      ) : null}
    </>
  );
}

/** Browser storage, per member and per device: the categories this member used last, newest first. */
const storageKey = (membershipId: string) => `expense-categories:${membershipId}`;

function readRecent(membershipId: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(membershipId)) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecent(membershipId: string, category: string) {
  try {
    window.localStorage.setItem(
      storageKey(membershipId),
      JSON.stringify(rememberCategory(readRecent(membershipId), category)),
    );
  } catch {
    // Storage can be blocked: the order simply stays as it was.
  }
}

/**
 * "+ Expense": the one primary button of the Money page. It opens the sheet at once with the
 * amount field focused, the category as chips (this member's most recent first), today as the
 * date and the note optional. A blank note is saved as the category's name.
 */
export function RecordExpenseSheet({
  periodQuery,
  today,
  locale,
  lbpPerUsd,
  categoryOptions,
  membershipId,
}: {
  periodQuery: LedgerPeriodQuery;
  today: string;
  locale: UiLocale;
  /** Current exchange rate for the live total; null when none is set. */
  lbpPerUsd: string | null;
  categoryOptions: { value: ExpenseCategory; label: string }[];
  /** Keys the "most recently used" order in this browser. */
  membershipId: string;
}) {
  const [open, setOpen] = useState(false);
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [ordered, setOrdered] = useState(categoryOptions);
  const [category, setCategory] = useState<ExpenseCategory>(categoryOptions[0]!.value);

  // Read the member's order when the sheet opens (browser storage is not available on the server).
  useEffect(() => {
    if (!open) return;
    const values = orderCategories(
      categoryOptions.map((option) => option.value),
      readRecent(membershipId),
    );
    const next = values.map((value) => categoryOptions.find((option) => option.value === value)!);
    setOrdered(next);
    setCategory(next[0]!.value);
  }, [open, membershipId, categoryOptions]);

  return (
    <>
      <Button type="button" className="min-h-11 flex-1" onClick={() => setOpen(true)}>
        {ui("owner.expensePlus", locale)}
      </Button>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>
              {ui("owner.recordExpense", locale)}
            </BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4 pb-4">
            <form
              action={submitRecordExpense}
              onSubmit={() => writeRecent(membershipId, category)}
              className="flex flex-col gap-4"
            >
              {keepPeriodQuery(periodQuery)}
              <div className="flex flex-col gap-2">
                <Label htmlFor="expenseUsd">{ui("owner.usd", locale)}</Label>
                <Input
                  id="expenseUsd"
                  type="text"
                  name="usdAmount"
                  inputMode="decimal"
                  placeholder="30.00"
                  value={usd}
                  onChange={(event) => setUsd(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expenseLbp">{ui("owner.lbp", locale)}</Label>
                <LbpInput id="expenseLbp" name="lbpAmount" value={lbp} onValueChange={setLbp} />
              </div>
              <TenderBalance
                usdText={usd}
                lbpText={lbp}
                lbpPerUsd={lbpPerUsd}
                targetUsd={null}
                locale={locale}
              />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 type-label">{ui("owner.category", locale)}</legend>
                <div role="radiogroup" className="flex flex-wrap gap-2">
                  {ordered.map((option) => (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        value={option.value}
                        checked={category === option.value}
                        onChange={() => setCategory(option.value)}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-full border px-4 type-label",
                          "peer-checked:border-transparent peer-checked:bg-selected peer-checked:text-selected-ink",
                          "peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                        )}
                      >
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label htmlFor="occurredOn">{ui("owner.when", locale)}</Label>
                <DateField
                  id="occurredOn"
                  name="occurredOn"
                  required
                  defaultValue={today}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">{ui("owner.noteOptional", locale)}</Label>
                <Input id="description" type="text" name="description" maxLength={200} />
              </div>
              <SubmitButton className="w-full">
                {ui("owner.recordExpenseSubmit", locale)}
              </SubmitButton>
            </form>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
