import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowLeft, ArrowRight, Check, MessageCircle, Phone, X } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import { BottomSheetDescription, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { PersonLink } from "@/modules/people/ui/person-link";
import { gameStatus, type GameStatusTone } from "@/modules/booking/ui/booking-sheet/game-status";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The main view and every step the sheet opens instead of growing (sub-screens with a back arrow). */
export type SheetStep =
  | "details"
  | "cancel"
  | "noshow"
  | "adjust"
  | "extend"
  | "repeat"
  | "series"
  | "other"
  | "items"
  | "more"
  | "shares"
  | "split";

const ROUND =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Call and WhatsApp in the sheet header: 44px round icon buttons. */
function HeaderIcon({ href, label, external = false, children }: { href: string; label: string; external?: boolean; children: ReactNode }) {
  return (
    <a href={href} aria-label={label} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={ROUND}>
      {children}
    </a>
  );
}

function CloseButton({ locale }: { locale: UiLocale }) {
  return (
    <DialogPrimitive.Close aria-label={ui("dialog.close", locale)} className={ROUND}>
      <X aria-hidden className="size-5" />
    </DialogPrimitive.Close>
  );
}

export function stepTitle(step: SheetStep, name: string, locale: UiLocale): string {
  switch (step) {
    case "noshow":
      return ui("owner.noShow", locale);
    case "adjust":
      return ui("owner.adjustDue", locale);
    case "extend":
      return ui("owner.extend", locale);
    case "repeat":
      return ui("owner.repeatWeekly", locale);
    case "series":
      return ui("owner.seriesSheetTitle", locale);
    case "other":
      return ui("owner.collectFor", locale).replace("{name}", name);
    case "items":
      return ui("owner.itemsHeading", locale);
    case "more":
      return ui("owner.moreActions", locale);
    case "shares":
    case "split":
      return ui("owner.splitPlayers", locale);
    case "cancel":
      return ui("owner.cancel", locale);
    case "details":
      return name;
  }
}

const CHIP: Record<GameStatusTone, string> = {
  neutral: "bg-surface-2 text-muted-foreground",
  accent: "bg-surface-2 text-foreground",
  owed: "bg-owed-subtle text-owed",
  paid: "bg-paid-subtle text-paid",
};

/** The one status chip under the name. */
export function StatusChip({ row, locale, nowMs }: { row: UpcomingRowView; locale: UiLocale; nowMs: number }) {
  const status = gameStatus({ display: row.display, startMs: row.startMs, nowMs, locale });
  return (
    <span data-status={status.kind} className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 type-label", CHIP[status.tone])}>
      {status.tone === "accent" ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent-brand" /> : null}
      {status.tone === "paid" ? <Check aria-hidden className="size-4 shrink-0" /> : null}
      {status.label}
    </span>
  );
}

/**
 * The sheet header. On the main view: the person's name, large, as the link to the person page, the one
 * status chip under it, and 44px round call, WhatsApp and close buttons on the other side. On a step: a
 * back arrow, the step's title ("Collect · <name>", "Items", ...) and close.
 */
export function SheetHeader({
  sheetRow,
  sheetStep,
  locale,
  onBack,
  nowMs,
}: {
  sheetRow: UpcomingRowView;
  sheetStep: SheetStep;
  locale: UiLocale;
  onBack: () => void;
  /** The clock for "in 25 min" (the sheet's render time). */
  nowMs: number;
}) {
  if (sheetStep !== "details") {
    const Back = locale === "ar" ? ArrowRight : ArrowLeft;
    return (
      <BottomSheetHeader className="flex-row items-center gap-2 pe-3">
        <button type="button" onClick={onBack} aria-label={ui("owner.itemsBack", locale)} className={ROUND}>
          <Back aria-hidden className="size-5" />
        </button>
        <BottomSheetTitle className="min-w-0 flex-1 truncate type-strong">
          <bdi>{stepTitle(sheetStep, sheetRow.requesterName, locale)}</bdi>
        </BottomSheetTitle>
        <BottomSheetDescription className="sr-only">{sheetRow.timeRange}</BottomSheetDescription>
        <CloseButton locale={locale} />
      </BottomSheetHeader>
    );
  }
  return (
    <BottomSheetHeader className="gap-2 pe-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <BottomSheetTitle className="sr-only">
            <bdi>{sheetRow.requesterName}</bdi>
          </BottomSheetTitle>
          <PersonLink personId={sheetRow.requesterPersonId} name={sheetRow.requesterName} prominent className="text-xl font-semibold" />
          <StatusChip row={sheetRow} locale={locale} nowMs={nowMs} />
        </div>
        {sheetRow.requesterPhone ? (
          <HeaderIcon href={`tel:${sheetRow.requesterPhone}`} label={ui("owner.callPlayer", locale)}>
            <Phone aria-hidden className="size-5" />
          </HeaderIcon>
        ) : null}
        {sheetRow.whatsAppHref ? (
          <HeaderIcon href={sheetRow.whatsAppHref} label={ui("owner.notifyWhatsApp", locale)} external>
            <MessageCircle aria-hidden className="size-5" />
          </HeaderIcon>
        ) : null}
        <CloseButton locale={locale} />
      </div>
      <BottomSheetDescription className="sr-only">{sheetRow.timeRange}</BottomSheetDescription>
    </BottomSheetHeader>
  );
}
