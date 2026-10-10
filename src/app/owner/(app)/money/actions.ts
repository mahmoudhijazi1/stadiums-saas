"use server";

import { z } from "zod";
import { getUiLocale } from "@/lib/get-ui-locale";
import { parseLbp, parseUsd } from "@/lib/format/parse-money";
import { actionErrorKey } from "@/lib/use-case-error";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { EXPENSE_CATEGORIES } from "@/modules/expense/domain/categories";
import { ui } from "@/lib/copy";
import { parseRecordExpense } from "@/modules/expense/schemas/record-expense";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { field, redirectOwner } from "@/app/owner/form-query";
import { loadActivityPage, type ActivityPageView } from "./activity-load";

const MONEY_KEEP = ["period", "filter", "from", "to", "view", "displayRate"] as const;

export async function submitRecordExpense(formData: FormData) {
  let errorKey: string | undefined;
  try {
    // The note is optional on the sheet: a blank one is saved as the category's name.
    const category = field(formData, "category");
    const note = field(formData, "description").trim();
    const parsed = parseRecordExpense({
      category,
      description: note || ((EXPENSE_CATEGORIES as readonly string[]).includes(category) ? ui(`cat.${category}`, await getUiLocale()) : ""),
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
  // `new` marks the row just saved (the newest), which Activity highlights briefly.
  redirectOwner("/owner/money", formData, MONEY_KEEP, { ok: "expense_recorded", new: "1" });
}

const moreSchema = z.strictObject({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filter: z.enum(["all", "in", "out"]),
  cursor: z.string().max(100),
});

/** "Show more" on Activity: the next 20. The use cases check reports.view. */
export async function loadMoreActivity(input: unknown): Promise<ActivityPageView | { error: string }> {
  try {
    return await loadActivityPage(moreSchema.parse(input), await getUiLocale());
  } catch (error) {
    return { error: await actionErrorKey(error, "loadMoreActivity") };
  }
}
