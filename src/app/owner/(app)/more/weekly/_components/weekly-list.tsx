"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { SeriesManage, type SeriesActions } from "@/modules/booking/ui/series-manage";
import { WeeklyConfirm } from "@/modules/booking/ui/weekly-confirm";
import { WeeklyCard, type WeeklyItem } from "@/app/owner/(app)/more/weekly/_components/weekly-card";

export type { WeeklyItem };

/**
 * Every weekly booking with games left: who, which weekday and time, weeks left, Renew. Tapping a
 * card opens the series sheet (the same one the booking sheet opens, with Cancel the rest);
 * Renew opens the renew step directly. The page passes the real Server Actions.
 */
export function WeeklyList({
  items,
  mayRenew,
  locale,
  seriesActions,
}: {
  items: WeeklyItem[];
  mayRenew: boolean;
  locale: UiLocale;
  seriesActions: SeriesActions;
}) {
  const router = useRouter();
  const [renewing, setRenewing] = useState<WeeklyItem | null>(null);
  const [opened, setOpened] = useState<WeeklyItem | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
        {items.map((item) => (
          <WeeklyCard key={item.seriesId} item={item} mayRenew={mayRenew} locale={locale} onOpen={setOpened} onRenew={setRenewing} />
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
              <WeeklyConfirm previewSeriesAction={seriesActions.previewSeriesAction} submitSeriesSave={seriesActions.submitSeriesSave}
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

      <BottomSheet open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        {opened ? (
          <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
            <BottomSheetHeader>
              <BottomSheetTitle>
                <bdi>{opened.personName}</bdi>
              </BottomSheetTitle>
            </BottomSheetHeader>
            <BottomSheetBody className="pb-4">
              <SeriesManage {...seriesActions}
                seriesId={opened.seriesId}
                locale={locale}
                confirmRef={confirmRef}
                onBack={() => {
                  setOpened(null);
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
