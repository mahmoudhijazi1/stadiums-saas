"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { SettingsRow, SettingsSection } from "../more/settings-list";
import { moneyHref } from "./query";

type Named = "today" | "week" | "month" | "last";
const NAMED: { kind: Named; key: string }[] = [
  { kind: "today", key: "owner.periodToday" },
  { kind: "week", key: "owner.periodWeek" },
  { kind: "month", key: "owner.periodMonth" },
  { kind: "last", key: "owner.periodLast" },
];

/**
 * The period chip and its sheet: Today, This week, This month, Last month, Custom. A
 * named period is a link (`?period=`), so the URL says what is shown; Custom asks for two
 * dates. The display toggle ($ / LBP) is kept when the period changes.
 */
export function PeriodSheet({
  label,
  kind,
  from,
  to,
  view,
  locale,
}: {
  label: string;
  kind: "today" | "week" | "month" | "last" | "custom";
  from: string;
  to: string;
  view: "usd" | "lbp";
  locale: UiLocale;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(kind === "custom");

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-4 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>{label}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("owner.periodTitle", locale)}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4 pb-4">
            <SettingsSection>
              {NAMED.map((item) => (
                <SettingsRow
                  key={item.kind}
                  label={ui(item.key, locale)}
                  href={moneyHref({ period: item.kind, view })}
                  selected={kind === item.kind}
                />
              ))}
              <SettingsRow
                label={ui("owner.periodCustom", locale)}
                onClick={() => setCustom((value) => !value)}
                selected={kind === "custom"}
              />
            </SettingsSection>
            {custom ? (
              <form method="get" action="/owner/money" className="flex flex-col gap-4">
                {view !== "usd" ? <input type="hidden" name="view" value={view} /> : null}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="from">{ui("owner.from", locale)}</Label>
                  <DateField id="from" name="from" required defaultValue={from} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="to">{ui("owner.to", locale)}</Label>
                  <DateField id="to" name="to" required defaultValue={to} />
                </div>
                <Button type="submit" className="w-full">
                  {ui("owner.show", locale)}
                </Button>
              </form>
            ) : null}
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
