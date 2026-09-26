"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { ClockRangeText, IsolatedDigits, LtrIsolate } from "@/components/ui/ltr-isolate";

export type DebtNotice = {
  totalCompact: string;
  reasonLabel: string | null;
  dateLabel: string;
};

export type NotifyPerson = {
  personId: string;
  name: string;
  phone: string | null;
  whatsAppHref: string | null;
  debt?: DebtNotice | null;
  message?: string | null;
  statusLabel?: string | null;
};

/** Isolate the digits inside a counted phrase such as "3 مهتمين". */
export function CountedPhrase({ text }: { text: string }) {
  const match = /^(\D*)(\d+)(\D*)$/.exec(text);
  if (!match) return text;
  return (
    <>
      {match[1]}
      <LtrIsolate>{match[2]}</LtrIsolate>
      {match[3]}
    </>
  );
}

/**
 * One wa.me row at a time (UX-01 §4.3). The check is local to this open list.
 */
export function NotifyPersonRow({
  person,
  locale,
  detail,
  href,
}: {
  person: NotifyPerson;
  locale: UiLocale;
  detail?: ReactNode;
  href?: string;
}) {
  const [sent, setSent] = useState(false);
  const name = href ? (
    <Link
      href={href}
      className="block truncate text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {person.name}
    </Link>
  ) : (
    <span className="block truncate text-sm font-medium">{person.name}</span>
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        {name}
        {person.statusLabel ? (
          <span className="block text-sm text-muted-foreground">
            {person.statusLabel}
          </span>
        ) : null}
        {detail ? (
          <span className="block text-sm text-muted-foreground">{detail}</span>
        ) : person.phone && !person.message ? (
          <LtrIsolate className="text-sm text-muted-foreground">
            {person.phone}
          </LtrIsolate>
        ) : null}
        {person.message ? (
          <span className="mt-1 block text-sm">{person.message}</span>
        ) : null}
        {person.debt ? (
          <span className="mt-1 block">
            <DebtNoticeLine
              notice={person.debt}
              personId={person.personId}
              locale={locale}
            />
          </span>
        ) : null}
      </span>
      {sent ? (
        <Check
          aria-label={ui("owner.notified", locale)}
          className="size-5 shrink-0"
        />
      ) : person.whatsAppHref ? (
        <Button asChild size="sm" className="min-h-11 shrink-0">
          <a
            href={person.whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSent(true)}
          >
            {ui("owner.notify", locale)}
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export function DebtNoticeLine({
  notice,
  personId,
  locale,
}: {
  notice: DebtNotice;
  personId: string;
  locale: UiLocale;
}) {
  return (
    <Link
      href={`/owner/people/${personId}`}
      className="text-sm text-alert underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {ui("owner.debtLead", locale)}{" "}
      <LtrIsolate>${notice.totalCompact}</LtrIsolate>
      <span aria-hidden> · </span>
      {notice.reasonLabel ? (
        <>
          {notice.reasonLabel}
          {locale === "en" ? ", " : "، "}
        </>
      ) : null}
      <IsolatedDigits text={notice.dateLabel} />
    </Link>
  );
}

export function NotifyList({
  people,
  locale,
}: {
  people: NotifyPerson[];
  locale: UiLocale;
}) {
  return (
    <ul className="flex flex-col">
      {people.map((person) => (
        <li
          key={person.personId}
          className="border-t py-3 first:border-t-0 first:pt-0"
        >
          <NotifyPersonRow
            person={person}
            locale={locale}
            href={`/owner/people/${person.personId}`}
          />
        </li>
      ))}
    </ul>
  );
}

export function InterestPanel({
  people,
  locale,
  timeRange,
  pitchName,
}: {
  people: NotifyPerson[];
  locale: UiLocale;
  timeRange?: string;
  pitchName?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {ui("owner.slotFree", locale)}{" "}
        <CountedPhrase
          text={uiCount("owner.interested", people.length, locale)}
        />
      </p>
      {timeRange ? (
        <p className="text-sm text-muted-foreground">
          <ClockRangeText text={timeRange} />
          {pitchName ? ` · ${pitchName}` : null}
        </p>
      ) : null}
      <NotifyList people={people} locale={locale} />
    </div>
  );
}
