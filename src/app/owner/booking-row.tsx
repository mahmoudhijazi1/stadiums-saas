import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import type { CardDisplay } from "@/modules/booking/domain/card-display";
import { cn } from "cn";

export type BookingRowVariant =
  | "upcoming"
  | "live"
  | "owed"
  | "partial"
  | "paid"
  | "no-show"
  | "cancelled"
  | "debt";

/** One variant per `deriveCardDisplay` state. No new states. */
export function variantOf(display: CardDisplay): BookingRowVariant {
  switch (display.kind) {
    case "before":
      return "upcoming";
    case "live":
      return "live";
    case "unpaid":
      return "owed";
    case "partial":
      return "partial";
    case "paid":
      return "paid";
    case "no_show_unpaid":
    case "no_show_paid":
      return "no-show";
    case "cancelled":
      return "cancelled";
  }
}

const PILL =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap";

/**
 * Status pill for the trailing slot. Only states that need attention or confirm something
 * get one: a plain upcoming game shows no pill and no price (ui-rules 2).
 */
export function StatusPill({
  display,
  amountUsd,
  locale,
}: {
  display: CardDisplay;
  amountUsd: string;
  locale: UiLocale;
}) {
  switch (display.kind) {
    case "before":
      return null;
    case "live":
      return (
        <span className={cn(PILL, "bg-muted text-foreground")}>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />
          <span>{ui("owner.live", locale)}</span>
          <span aria-hidden>·</span>
          <LtrIsolate>{display.minutesLeft}</LtrIsolate>
          <span>{ui("owner.minLeft", locale)}</span>
        </span>
      );
    case "unpaid":
    case "partial":
      return (
        <OwedPill
          amountUsd={amountUsd}
          word={ui(display.kind === "partial" ? "owner.leftShort" : "owner.dueShort", locale)}
        />
      );
    case "paid":
      return (
        <span className={cn(PILL, "bg-paid-subtle text-paid")}>
          <CircleCheck aria-hidden className="size-4 shrink-0" />
          <span>{ui("owner.paid", locale)}</span>
        </span>
      );
    case "no_show_unpaid":
      return (
        <span className={cn(PILL, "bg-owed-subtle text-owed")}>
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          <span>{ui("owner.noShow", locale)}</span>
          <span aria-hidden>·</span>
          <LtrIsolate>${amountUsd}</LtrIsolate>
          <span>{ui("owner.dueShort", locale)}</span>
        </span>
      );
    case "no_show_paid":
      return (
        <span className={cn(PILL, "bg-expected-subtle text-muted-foreground")}>
          <span>{ui("owner.noShow", locale)}</span>
          <span aria-hidden>·</span>
          <CircleCheck aria-hidden className="size-4 shrink-0 text-paid" />
          <span>{ui("owner.paid", locale)}</span>
        </span>
      );
    case "cancelled":
      return (
        <span className={cn(PILL, "bg-expected-subtle text-muted-foreground")}>
          {ui("owner.cancelledShort", locale)}
        </span>
      );
  }
}

/** Owed token and icon: "$30 due" / "$12 left". */
export function OwedPill({ amountUsd, word }: { amountUsd: string; word: string }) {
  return (
    <span className={cn(PILL, "bg-owed-subtle text-owed")}>
      <CircleAlert aria-hidden className="size-4 shrink-0" />
      <LtrIsolate>${amountUsd}</LtrIsolate>
      <span>{word}</span>
    </span>
  );
}

/**
 * The one booking card (Today games, earlier debts, person page).
 *
 * Line 1 is the title (the player, semibold, the largest text, wraps instead of truncating);
 * line 2 is `meta` (time range, muted). The pill sits in the trailing slot, vertically
 * centred. The whole card is the tap target (`onOpen`), min 64px tall, with a pressed
 * state and no nested interactive element. The debt variant adds an amber edge and a
 * separate `action` button, at least 12px away from the tappable body.
 */
export function BookingRow({
  variant,
  title,
  meta,
  pill,
  footer,
  action,
  onOpen,
  expanded,
  highlighted = false,
  open = false,
}: {
  variant: BookingRowVariant;
  title: ReactNode;
  meta: ReactNode;
  pill?: ReactNode;
  /** Extra line under the body (e.g. the per-player share on the person page). */
  footer?: ReactNode;
  /** Debt variant: the Collect button, a sibling of the body, never inside it. */
  action?: ReactNode;
  /** Absent: a static card (person page). */
  onOpen?: () => void;
  expanded?: boolean;
  highlighted?: boolean;
  open?: boolean;
}) {
  const face = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-base leading-snug font-semibold break-words",
            variant === "cancelled" && "text-muted-foreground line-through",
          )}
        >
          {title}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          {meta}
        </span>
      </span>
      {pill ? <span className="shrink-0 self-center">{pill}</span> : null}
    </>
  );
  const bodyClass = "flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-start";

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden py-0 shadow-none",
        variant === "debt" && "border-s-4 border-s-owed",
        (open || highlighted) && "ring-2 ring-inset ring-action-ink",
        highlighted && !open && "bg-action-ink/10",
      )}
    >
      <div className="flex w-full items-center">
        {onOpen ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={expanded ?? open}
            onClick={onOpen}
            className={cn(
              bodyClass,
              "cursor-pointer bg-transparent outline-none transition-colors active:bg-muted/70",
              "focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
            )}
          >
            {face}
          </button>
        ) : (
          <div className={bodyClass}>{face}</div>
        )}
        {action ? <div className="ms-3 shrink-0 self-center pe-3">{action}</div> : null}
      </div>
      {footer ? <div className="px-4 pb-3">{footer}</div> : null}
    </Card>
  );
}
