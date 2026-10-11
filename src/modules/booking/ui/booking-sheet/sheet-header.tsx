import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { MessageCircle, Phone, X } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import { ClockRangeText } from "@/components/ui/ltr-isolate";
import { BottomSheetDescription, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { PersonLink } from "@/modules/people/ui/person-link";
import { ExtendedMark } from "@/modules/booking/ui/extend-form";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

export type SheetStep = "details" | "cancel" | "noshow" | "adjust" | "extend" | "repeat" | "series";

/** Call and WhatsApp in the sheet header: a 36px circle inside a 44px hit area. */
function HeaderIcon({
  href,
  label,
  external = false,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex size-11 shrink-0 items-center justify-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50"
    >
      <span className="grid size-9 place-items-center rounded-full border text-muted-foreground hover:bg-muted">{children}</span>
    </a>
  );
}

function stepTitle(step: SheetStep, locale: UiLocale): string {
  if (step === "noshow") return ui("owner.noShow", locale);
  if (step === "adjust") return ui("owner.adjustDue", locale);
  if (step === "extend") return ui("owner.extend", locale);
  if (step === "repeat") return ui("owner.repeatWeekly", locale);
  if (step === "series") return ui("owner.seriesSheetTitle", locale);
  return ui("owner.cancel", locale);
}

/** The sheet header: name, call and WhatsApp, close, then the time (or the step title) and the place. */
export function SheetHeader({
  sheetRow,
  sheetStep,
  locale,
  showDate,
}: {
  sheetRow: UpcomingRowView;
  sheetStep: SheetStep;
  locale: UiLocale;
  /** The game is listed under To collect, so its date is shown. */
  showDate: boolean;
}) {
  return (
            <BottomSheetHeader className="gap-0 pe-3">
              <div className="flex items-center gap-1">
                <PersonLink
                  personId={sheetRow.requesterPersonId}
                  name={sheetRow.requesterName}
                  prominent
                  className="min-w-0 flex-1"
                />
                {sheetRow.requesterPhone ? (
                  <HeaderIcon href={`tel:${sheetRow.requesterPhone}`} label={ui("owner.callPlayer", locale)}>
                    <Phone aria-hidden className="size-5" />
                  </HeaderIcon>
                ) : null}
                {sheetStep === "details" && sheetRow.whatsAppHref ? (
                  <HeaderIcon href={sheetRow.whatsAppHref} label={ui("owner.notifyWhatsApp", locale)} external>
                    <MessageCircle aria-hidden className="size-5" />
                  </HeaderIcon>
                ) : null}
                <DialogPrimitive.Close
                  aria-label={ui("dialog.close", locale)}
                  className="inline-flex size-11 shrink-0 items-center justify-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50"
                >
                  <span className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                    <X aria-hidden className="size-5" />
                  </span>
                </DialogPrimitive.Close>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 type-secondary tabular-nums">
                <BottomSheetTitle
                  className="type-secondary font-normal"
                  aria-label={sheetStep !== "details" ? stepTitle(sheetStep, locale) : sheetRow.timeRange}
                >
                  <span className="grid">
                    <span
                      className={cn(
                        "col-start-1 row-start-1 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                        sheetStep !== "details" ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden={sheetStep === "details"}
                    >
                      {stepTitle(sheetStep, locale)}
                    </span>
                    <span
                      className={cn(
                        "col-start-1 row-start-1 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                        sheetStep !== "details" ? "opacity-0" : "opacity-100",
                      )}
                      aria-hidden={sheetStep !== "details"}
                    >
                      <ClockRangeText text={sheetRow.timeRange} />
                      <ExtendedMark minutes={sheetRow.extendedMinutes} locale={locale} />
                    </span>
                  </span>
                </BottomSheetTitle>
                <BottomSheetDescription className="type-secondary">
                  {[
                    sheetRow.pitchName,
                    showDate ? sheetRow.dateLabel : null,
                    sheetRow.nightHint,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </BottomSheetDescription>
              </div>
            </BottomSheetHeader>
  );
}
