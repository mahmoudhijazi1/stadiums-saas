"use client";

import { useState } from "react";
import type { UiLocale } from "@/lib/locale";
import {
  collectUsdLabel,
  overdueCount,
  ui,
} from "@/lib/ui-copy";
import {
  submitCancelBooking,
  submitCollectPayment,
  submitRecordNoShow,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import type { UpcomingStatus } from "@/modules/booking/domain/home-inbox";
import { CircleCheck, Clock, MapPin, Phone } from "lucide-react";

export type UpcomingRowView = {
  id: string;
  pitchName: string;
  timeRange: string;
  dateLabel: string;
  requesterName: string;
  requesterPhone: string;
  remainingUsd: string;
  priceUsd: string;
  status: UpcomingStatus;
  confirmWhatsAppHref: string | null;
  showCancel: boolean;
  showNoShow: boolean;
};

function keepTenantQuery(tenantSlug: string) {
  return <input type="hidden" name="tenant" value={tenantSlug} />;
}

function StatusBadge({
  status,
  locale,
}: {
  status: UpcomingStatus;
  locale: UiLocale;
}) {
  if (status === "due") {
    return <Badge variant="outline">{ui("owner.due", locale)}</Badge>;
  }
  if (status === "paid") {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        <CircleCheck aria-hidden className="size-3 text-primary" />
        {ui("owner.paid", locale)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {ui("owner.upcomingTag", locale)}
    </Badge>
  );
}

function DueRemainingFigures({
  dueUsd,
  remainingUsd,
  locale,
}: {
  dueUsd: string;
  remainingUsd: string;
  locale: UiLocale;
}) {
  const owed = remainingUsd !== "0.00";

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg bg-muted px-3 py-2">
        <p className="text-xs text-muted-foreground">{ui("owner.due", locale)}</p>
        <p className="mt-0.5 text-base font-semibold text-foreground">
          <LtrIsolate>${dueUsd}</LtrIsolate>
        </p>
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2",
          owed ? "bg-primary/15" : "bg-muted",
        )}
      >
        <p
          className={cn(
            "text-xs",
            owed ? "text-primary" : "text-muted-foreground",
          )}
        >
          {ui("owner.remaining", locale)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-base font-semibold",
            owed ? "text-primary" : "text-muted-foreground",
          )}
        >
          <LtrIsolate>${remainingUsd}</LtrIsolate>
        </p>
      </div>
    </div>
  );
}

export function UpcomingPanel({
  overdue,
  today,
  later,
  tenantSlug,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  highlight,
}: {
  overdue: UpcomingRowView[];
  today: UpcomingRowView[];
  later: UpcomingRowView[];
  tenantSlug: string;
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  highlight?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showComing, setShowComing] = useState(
    () => Boolean(highlight && later.some((row) => row.id === highlight)),
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {ui("owner.upcoming", locale)}
      </h3>

      {overdue.length > 0 ? (
        <>
          <h4 className="text-sm font-medium text-muted-foreground">
            {overdueCount(overdue.length, locale)}
          </h4>
          <UpcomingRows
            rows={overdue}
            showDate
            openId={openId}
            onToggle={setOpenId}
            tenantSlug={tenantSlug}
            locale={locale}
            mayCollect={mayCollect}
            mayCancel={mayCancel}
            mayNoShow={mayNoShow}
            highlight={highlight}
          />
        </>
      ) : null}

      {today.length > 0 ? (
        <UpcomingRows
          rows={today}
          showDate={false}
          openId={openId}
          onToggle={setOpenId}
          tenantSlug={tenantSlug}
          locale={locale}
          mayCollect={mayCollect}
          mayCancel={mayCancel}
          mayNoShow={mayNoShow}
          highlight={highlight}
        />
      ) : overdue.length === 0 ? (
        <EmptyState
          title={ui("empty.confirmed", locale)}
          next={ui("empty.confirmedNext", locale)}
        />
      ) : null}

      {later.length > 0 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() => setShowComing((open) => !open)}
          >
            {showComing
              ? ui("owner.hideComingDays", locale)
              : ui("owner.showComingDays", locale)}
          </Button>
          {showComing ? (
            <UpcomingRows
              rows={later}
              showDate
              openId={openId}
              onToggle={setOpenId}
              tenantSlug={tenantSlug}
              locale={locale}
              mayCollect={mayCollect}
              mayCancel={mayCancel}
              mayNoShow={mayNoShow}
              highlight={highlight}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function UpcomingRows({
  rows,
  showDate,
  openId,
  onToggle,
  tenantSlug,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  highlight,
}: {
  rows: UpcomingRowView[];
  showDate: boolean;
  openId: string | null;
  onToggle: (id: string | null) => void;
  tenantSlug: string;
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  highlight?: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const open = openId === row.id;
        const highlighted = highlight === row.id;
        return (
          <li key={row.id} id={`booking-${row.id}`}>
            <Card
              className={cn(
                "gap-0 py-0",
                (open || highlighted) && "ring-2 ring-inset ring-primary",
                highlighted && !open && "bg-primary/10",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(open ? null : row.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Clock
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <LtrIsolate className="text-lg font-semibold leading-none">
                      {row.timeRange}
                    </LtrIsolate>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-4 shrink-0" />
                      {row.pitchName}
                    </span>
                    {showDate ? <span>{row.dateLabel}</span> : null}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {row.requesterName}
                  </span>
                </span>
                <StatusBadge status={row.status} locale={locale} />
              </button>
              {open ? (
                <CardContent className="flex flex-col gap-4 border-t px-4 py-4">
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone aria-hidden className="size-4 shrink-0" />
                    <LtrIsolate>{row.requesterPhone}</LtrIsolate>
                  </p>
                  {row.confirmWhatsAppHref ? (
                    <div className="flex flex-col gap-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        {ui("owner.notifyGroup", locale)}
                      </h4>
                      <Button variant="outline" className="w-full" asChild>
                        <a
                          href={row.confirmWhatsAppHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {ui("owner.notify", locale)}
                        </a>
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-4">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {ui("owner.moneyGroup", locale)}
                    </h4>
                    <DueRemainingFigures
                      dueUsd={row.priceUsd}
                      remainingUsd={row.remainingUsd}
                      locale={locale}
                    />
                    {mayCollect && row.status !== "paid" ? (
                      <>
                        <form action={submitCollectPayment}>
                          <input type="hidden" name="bookingId" value={row.id} />
                          {keepTenantQuery(tenantSlug)}
                          <input
                            type="hidden"
                            name="usdAmount"
                            value={row.remainingUsd}
                          />
                          <SubmitButton className="w-full">
                            {collectUsdLabel(row.remainingUsd, locale)}
                          </SubmitButton>
                        </form>
                        <form
                          action={submitCollectPayment}
                          className="flex flex-col gap-4"
                        >
                          <input type="hidden" name="bookingId" value={row.id} />
                          {keepTenantQuery(tenantSlug)}
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`usd-${row.id}`}>
                              {ui("owner.usd", locale)}
                            </Label>
                            <Input
                              id={`usd-${row.id}`}
                              type="text"
                              name="usdAmount"
                              inputMode="decimal"
                              placeholder="30.00"
                              className="font-mono"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`lbp-${row.id}`}>
                              {ui("owner.lbp", locale)}
                            </Label>
                            <Input
                              id={`lbp-${row.id}`}
                              type="text"
                              name="lbpAmount"
                              inputMode="numeric"
                              className="font-mono"
                            />
                          </div>
                          <SubmitButton variant="secondary" className="w-full">
                            {ui("owner.collectMixed", locale)}
                          </SubmitButton>
                        </form>
                      </>
                    ) : null}
                    {mayCancel && row.showCancel ? (
                      <form action={submitCancelBooking}>
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepTenantQuery(tenantSlug)}
                        <SubmitButton variant="outline" className="w-full">
                          {ui("owner.cancel", locale)}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {mayNoShow && row.showNoShow ? (
                      <form action={submitRecordNoShow}>
                        <input type="hidden" name="bookingId" value={row.id} />
                        {keepTenantQuery(tenantSlug)}
                        <SubmitButton variant="outline" className="w-full">
                          {ui("owner.noShow", locale)}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </CardContent>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
