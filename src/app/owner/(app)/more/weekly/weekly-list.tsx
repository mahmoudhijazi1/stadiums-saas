"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { WeeklyConfirm } from "@/app/owner/(app)/series/weekly-confirm";

export type WeeklyItem = {
  seriesId: string;
  personName: string;
  /** "Every Tue 8:00 PM". */
  when: string;
  /** Null when the stadium has one pitch. */
  pitchName: string | null;
  left: number;
};

/** Every weekly booking with games left: who, which weekday and time, weeks left, Renew. */
export function WeeklyList({
  items,
  mayRenew,
  locale,
}: {
  items: WeeklyItem[];
  mayRenew: boolean;
  locale: UiLocale;
}) {
  const router = useRouter();
  const [renewing, setRenewing] = useState<WeeklyItem | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
        {items.map((item) => (
          <li key={item.seriesId} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
            <span className="flex min-w-0 flex-col">
              <span className="type-strong">
                <bdi>{item.personName}</bdi>
              </span>
              <span className="type-secondary">
                <LtrIsolate>{item.when}</LtrIsolate>
                {item.pitchName ? <span> · {item.pitchName}</span> : null}
              </span>
              <span className="type-caption">{ui("owner.weeklyLeft", locale).replace("{n}", String(item.left))}</span>
            </span>
            {mayRenew ? (
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setRenewing(item)}>
                {ui("owner.weeklyRenew", locale)}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <BottomSheet open={renewing !== null} onOpenChange={(open) => !open && setRenewing(null)}>
        {renewing ? (
          <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
            <BottomSheetHeader>
              <BottomSheetTitle>
                <bdi>{renewing.personName}</bdi>
              </BottomSheetTitle>
            </BottomSheetHeader>
            <BottomSheetBody className="pb-4">
              <WeeklyConfirm
                source={{ kind: "renew", seriesId: renewing.seriesId }}
                locale={locale}
                confirmRef={confirmRef}
                onBack={() => {
                  setRenewing(null);
                  router.refresh();
                }}
              />
            </BottomSheetBody>
          </BottomSheetContent>
        ) : null}
      </BottomSheet>
    </>
  );
}
