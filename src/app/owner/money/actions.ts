"use server";

import { parseLbp, parseUsd } from "@/lib/money";
import { actionErrorKey } from "@/lib/use-case-error";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { parseRecordExpense } from "@/modules/expense/schemas/record-expense";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { parseExchangeRate } from "@/modules/payment/schemas/exchange-rate";
import { field, redirectOwner } from "@/app/owner/form-query";

const MONEY_KEEP = ["tenant", "from", "to", "view", "displayRate"] as const;

export async function submitSetExchangeRate(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseExchangeRate({
      lbpPerUsd: field(formData, "lbpPerUsd"),
    });
    await setExchangeRate(parseLbp(parsed.lbpPerUsd));
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitSetExchangeRate");
  }
  if (errorKey) {
    redirectOwner("/owner/money", formData, MONEY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/money", formData, MONEY_KEEP, { ok: "rate_set" });
}

export async function submitRecordExpense(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseRecordExpense({
      category: field(formData, "category"),
      description: field(formData, "description"),
      occurredOn: field(formData, "occurredOn"),
      usdAmount: field(formData, "usdAmount"),
      lbpAmount: field(formData, "lbpAmount"),
    });
    const tenders: TenderDraft[] = [];
    if (parsed.usdAmount) {
      tenders.push({ currency: "USD", amount: parseUsd(parsed.usdAmount) });
    }
    if (parsed.lbpAmount) {
      tenders.push({ currency: "LBP", amount: parseLbp(parsed.lbpAmount) });
    }
    await recordExpense({
      category: parsed.category,
      description: parsed.description,
      occurredOn: parsed.occurredOn,
      tenders,
    });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitRecordExpense");
  }
  if (errorKey) {
    redirectOwner("/owner/money", formData, MONEY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/money", formData, MONEY_KEEP, { ok: "expense_recorded" });
}
