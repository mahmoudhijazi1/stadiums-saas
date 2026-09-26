"use client";

import { useState } from "react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Card } from "@/components/ui/card";
import { ClockRangeText } from "@/components/ui/ltr-isolate";
import {
  CountedPhrase,
  InterestPanel,
  type NotifyPerson,
} from "@/app/owner/notify-list";

export type FreeSlotView = {
  key: string;
  timeRange: string;
  dateLabel: string;
  pitchName: string;
  countLabel: string;
  people: NotifyPerson[];
};

export function FreeSlotList({
  groups,
  locale,
}: {
  groups: FreeSlotView[];
  locale: UiLocale;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = groups.find((group) => group.key === openKey) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {ui("owner.freeSlots", locale)}
      </h3>
      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.key}>
            <Card className="py-0">
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col items-start gap-1 px-4 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                onClick={() => setOpenKey(group.key)}
              >
                <ClockRangeText
                  text={group.timeRange}
                  className="text-lg font-semibold leading-none"
                />
                <span className="text-sm text-muted-foreground">
                  {group.pitchName}
                  <span aria-hidden> · </span>
                  {group.dateLabel}
                  <span aria-hidden> · </span>
                  <CountedPhrase text={group.countLabel} />
                </span>
              </button>
            </Card>
          </li>
        ))}
      </ul>
      <BottomSheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenKey(null);
        }}
      >
        {open ? (
          <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
            <BottomSheetHeader>
              <BottomSheetTitle>
                <ClockRangeText
                  text={open.timeRange}
                  className="text-xl font-bold leading-none"
                />
              </BottomSheetTitle>
            </BottomSheetHeader>
            <BottomSheetBody>
              <InterestPanel
                people={open.people}
                locale={locale}
                timeRange={open.timeRange}
                pitchName={open.pitchName}
              />
            </BottomSheetBody>
          </BottomSheetContent>
        ) : null}
      </BottomSheet>
    </section>
  );
}
