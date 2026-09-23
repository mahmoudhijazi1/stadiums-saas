"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";

function keepPeriodQuery(period: LedgerPeriodQuery) {
  return (
    <>
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

export function RecordExpenseSheet({
  periodQuery,
  today,
  locale,
  categoryOptions,
}: {
  periodQuery: LedgerPeriodQuery;
  today: string;
  locale: UiLocale;
  categoryOptions: { value: ExpenseCategory; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        {ui("owner.addExpense", locale)}
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
              className="flex flex-col gap-4"
            >
              {keepPeriodQuery(periodQuery)}
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">{ui("owner.category", locale)}</Label>
                <SelectField
                  id="category"
                  name="category"
                  required
                  defaultValue="ELECTRICITY"
                  options={categoryOptions}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">{ui("owner.what", locale)}</Label>
                <Input
                  id="description"
                  type="text"
                  name="description"
                  required
                  maxLength={200}
                />
              </div>
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
                <Label htmlFor="expenseUsd">{ui("owner.usd", locale)}</Label>
                <Input
                  id="expenseUsd"
                  type="text"
                  name="usdAmount"
                  inputMode="decimal"
                  placeholder="30.00"
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expenseLbp">{ui("owner.lbp", locale)}</Label>
                <Input
                  id="expenseLbp"
                  type="text"
                  name="lbpAmount"
                  inputMode="numeric"
                  className="font-mono"
                />
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
