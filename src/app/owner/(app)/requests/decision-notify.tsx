"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  NotifyList,
  type NotifyPerson,
} from "@/app/owner/notify-list";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * Shared notify list after approve or reject (UX-01 §4.3).
 * Closing drops the notify query so a refresh does not reopen it.
 */
export function DecisionNotifySheet({
  people,
  locale,
}: {
  people: NotifyPerson[];
  locale: UiLocale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("notify");
    next.delete("bookingId");
    next.delete("reason");
    next.delete("siblings");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        <BottomSheetHeader>
          <BottomSheetTitle>{ui("owner.notifySheet", locale)}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="pb-4">
          <NotifyList people={people} locale={locale} />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}
