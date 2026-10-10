"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Receipt, ShoppingBag, Store, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";
import {
  dayHeading,
  groupByDay,
  signedAmount,
  type ActivityRowView,
  type ExpenseDetailView,
  type SaleDetailView,
} from "./activity-map";
import { formatLbpAmount, formatUsdAmount, groupDigits } from "@/lib/format/money";
import { loadMoreActivity } from "./actions";
import { activityHref } from "./query";

const ICONS = { booking: Trophy, expense: Receipt, shop: Store, generic: ShoppingBag } as const;

type Filter = "all" | "in" | "out";

const own = (currency: "USD" | "LBP", value: string, locale: UiLocale) =>
  currency === "LBP" ? formatLbpAmount(value, locale) : formatUsdAmount(value);

/**
 * Activity: every ledger movement in the period, newest first, grouped by day, with
 * All / In / Out chips and "Show more" (20 per page, keyset). In is green with a plus, Out
 * is neutral with a minus. A game opens on Today; an expense opens a sheet with its tenders.
 * `highlightFirst` marks the row just saved, briefly.
 */
export function ActivityList({
  initialRows,
  initialCursor,
  filter,
  range,
  periodKey,
  now,
  highlightFirst,
  locale,
  variant = "full",
  allHref,
}: {
  /** "recent": the Money page's short list (no chips, no Show more, a link to the full page). */
  variant?: "full" | "recent";
  /** Where "All activity" goes (recent variant). */
  allHref?: string;
  initialRows: ActivityRowView[];
  initialCursor: string | null;
  filter: Filter;
  range: { from: string; to: string };
  /** The period/view part of the URL, so the filter chips keep it. */
  periodKey: { period?: "today" | "week" | "month" | "last" | "custom"; from?: string; to?: string; view: "usd" | "lbp" };
  /** ISO of "now" on the server, so Today/Yesterday agree with the first render. */
  now: string;
  highlightFirst: boolean;
  locale: UiLocale;
}) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExpenseDetailView | null>(null);
  const [sale, setSale] = useState<SaleDetailView | null>(null);
  const [highlight, setHighlight] = useState<string | null>(highlightFirst ? (initialRows[0]?.id ?? null) : null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(timer);
  }, [highlight]);

  function more() {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMoreActivity({ ...range, filter, cursor });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      setRows((current) => [...current, ...result.rows]);
      setCursor(result.nextCursor);
    });
  }

  const nowDate = new Date(now);
  const chips: { value: Filter; label: string }[] = [
    { value: "all", label: ui("owner.activityAll", locale) },
    { value: "in", label: ui("owner.in", locale) },
    { value: "out", label: ui("owner.out", locale) },
  ];

  return (
    <section id="activity" className="flex scroll-mt-4 flex-col gap-3">
      <h3 className="type-section">{ui(variant === "recent" ? "owner.recentActivity" : "owner.activity", locale)}</h3>
      {variant === "full" ? (
      <div role="group" aria-label={ui("owner.activity", locale)} className="flex gap-2">
        {chips.map((chip) => (
          <Link
            key={chip.value}
            href={activityHref({ ...periodKey, filter: chip.value })}
            scroll={false}
            aria-current={filter === chip.value ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              filter === chip.value ? "border-transparent bg-selected text-selected-ink" : "bg-card",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="type-secondary">{ui("owner.activityEmpty", locale)}</p>
      ) : (
        groupByDay(rows).map((group) => (
          <div key={group.day} className="flex flex-col gap-1">
            <h4 className="px-1 pt-2 type-caption">{dayHeading(group.day, nowDate, locale)}</h4>
            <ul className="overflow-hidden rounded-xl border bg-card">
              {group.rows.map((row) => (
                <li key={row.id} className="border-b last:border-b-0">
                  <ActivityRow
                    row={row}
                    highlighted={row.id === highlight}
                    onOpenExpense={setDetail}
                    onOpenSale={setSale}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}
      {variant === "full" && cursor ? (
        <Button type="button" variant="secondary" className="w-full" onClick={more} disabled={pending}>
          {ui("owner.showMore", locale)}
        </Button>
      ) : null}
      {variant === "recent" && allHref ? (
        <Link
          href={allHref}
          className="inline-flex min-h-11 items-center gap-1 self-start rounded-md type-label text-action-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {ui("owner.allActivity", locale)}
          <span aria-hidden className="rtl:rotate-180">›</span>
        </Link>
      ) : null}

      <ExpenseDetailSheet detail={detail} onClose={() => setDetail(null)} locale={locale} />
      <SaleDetailSheet detail={sale} onClose={() => setSale(null)} locale={locale} />
    </section>
  );
}

function ActivityRow({
  row,
  highlighted,
  onOpenExpense,
  onOpenSale,
}: {
  row: ActivityRowView;
  highlighted: boolean;
  onOpenExpense: (detail: ExpenseDetailView) => void;
  onOpenSale: (detail: SaleDetailView) => void;
}) {
  const Icon = ICONS[row.icon];
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-body truncate">
          <bdi>{row.label}</bdi>
        </span>
        {row.secondary ? <span className="type-caption">{row.secondary}</span> : null}
      </span>
      <span className={cn("type-strong shrink-0", row.direction === "IN" && "text-paid")}>
        <LtrIsolate>{signedAmount(row.direction, row.amountUsd)}</LtrIsolate>
      </span>
    </>
  );
  const className = cn(
    "flex min-h-14 w-full items-center gap-3 bg-card px-4 py-2 text-start outline-none transition-colors duration-700 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
    highlighted && "bg-action-ink/15",
  );

  if (row.open?.kind === "link") {
    return (
      <Link href={row.open.href} className={className}>
        {body}
      </Link>
    );
  }
  if (row.open?.kind === "expense") {
    const detail = row.open.detail;
    return (
      <button type="button" aria-haspopup="dialog" onClick={() => onOpenExpense(detail)} className={className}>
        {body}
      </button>
    );
  }
  if (row.open?.kind === "sale") {
    const detail = row.open.detail;
    return (
      <button type="button" aria-haspopup="dialog" onClick={() => onOpenSale(detail)} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function ExpenseDetailSheet({
  detail,
  onClose,
  locale,
}: {
  detail: ExpenseDetailView | null;
  onClose: () => void;
  locale: UiLocale;
}) {
  return (
    <BottomSheet open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        {detail ? (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>{detail.description.trim() || detail.categoryLabel}</BottomSheetTitle>
            </BottomSheetHeader>
            <BottomSheetBody className="flex flex-col gap-4 pb-4">
              <dl className="flex flex-col gap-3">
                <Detail label={ui("owner.expenseAmount", locale)}>
                  <LtrIsolate className="type-strong">{`−$${detail.amountUsd}`}</LtrIsolate>
                </Detail>
                <Detail label={ui("owner.expenseCategory", locale)}>{detail.categoryLabel}</Detail>
                <Detail label={ui("owner.expenseDate", locale)}>
                  <LtrIsolate>{detail.dateLabel}</LtrIsolate>
                </Detail>
              </dl>
              {detail.tenders.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="type-section">{ui("owner.paidWith", locale)}</p>
                  <ul className="overflow-hidden rounded-xl border bg-card">
                    {detail.tenders.map((tender, index) => (
                      <li key={index} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                        <span className="type-body">
                          <LtrIsolate>
                            {tender.currency === "USD" ? `$${tender.amount}` : `${groupDigits(tender.amount)} LBP`}
                          </LtrIsolate>
                        </span>
                        <span className="type-secondary">
                          {tender.currency === "LBP" && tender.rate ? (
                            <LtrIsolate>{`@ ${groupDigits(tender.rate)} → $${tender.usd}`}</LtrIsolate>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </BottomSheetBody>
          </>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SaleDetailSheet({
  detail,
  onClose,
  locale,
}: {
  detail: SaleDetailView | null;
  onClose: () => void;
  locale: UiLocale;
}) {
  return (
    <BottomSheet open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        {detail ? (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>{ui("owner.shop", locale)}</BottomSheetTitle>
            </BottomSheetHeader>
            <BottomSheetBody className="flex flex-col gap-4 pb-4">
              <dl className="flex flex-col gap-3">
                <Detail label={ui("owner.sellTotal", locale)}>
                  <LtrIsolate className="type-strong">{`+$${detail.totalUsd}`}</LtrIsolate>
                </Detail>
                <Detail label={ui("owner.expenseDate", locale)}>
                  <LtrIsolate>{detail.dateLabel}</LtrIsolate>
                </Detail>
              </dl>
              <div className="flex flex-col gap-1">
                <p className="type-section">{ui("owner.shopSoldLine", locale)}</p>
                <ul className="overflow-hidden rounded-xl border bg-card">
                  {detail.lines.map((line, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                      <span className="type-body min-w-0 truncate">
                        <bdi>{line.name}</bdi>
                      </span>
                      <span className="type-secondary shrink-0">
                        <LtrIsolate>{`${line.qty} × ${own(line.currency, line.unit, locale)} = ${own(line.currency, line.total, locale)}`}</LtrIsolate>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {detail.tenders.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="type-section">{ui("owner.paidWith", locale)}</p>
                  <ul className="overflow-hidden rounded-xl border bg-card">
                    {detail.tenders.map((tender, index) => (
                      <li key={index} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                        <span className="type-body">
                          <LtrIsolate>
                            {tender.currency === "USD" ? `$${tender.amount}` : `${groupDigits(tender.amount)} LBP`}
                          </LtrIsolate>
                        </span>
                        <span className="type-secondary">
                          {tender.currency === "LBP" && tender.rate ? (
                            <LtrIsolate>{`@ ${groupDigits(tender.rate)} → $${tender.usd}`}</LtrIsolate>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </BottomSheetBody>
          </>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="type-secondary">{label}</dt>
      <dd className="type-body">{children}</dd>
    </div>
  );
}
