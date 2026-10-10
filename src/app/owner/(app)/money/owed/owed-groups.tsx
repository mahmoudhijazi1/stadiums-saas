"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageCircle } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import { cn } from "cn";
import { DebtRow, type DebtRowView } from "../../today/debt-row";

export type OwedGroupView = {
  key: string;
  /** Null for the one "Unnamed players" group. */
  name: string | null;
  totalLabel: string;
  games: number;
  /** A WhatsApp reminder link, when there is a number to send it to. */
  reminderHref: string | null;
  debts: { key: string; href: string; view: DebtRowView }[];
};

/**
 * Owed money by person, newest debt first. Each person expands (collapsed to begin with)
 * into debt rows, the same compact row as the earlier-days debts on Today, with Collect
 * (which opens the game on Today, where the payment is taken) and a WhatsApp reminder.
 */
export function OwedGroups({
  groups,
  mayCollect,
  locale,
}: {
  groups: OwedGroupView[];
  mayCollect: boolean;
  locale: UiLocale;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(groups.length === 1 ? (groups[0]?.key ?? null) : null);

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const open = openKey === group.key;
        const panel = `owed-${group.key}`;
        return (
          <li key={group.key} className="overflow-hidden rounded-xl border bg-card">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panel}
              onClick={() => setOpenKey(open ? null : group.key)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="type-strong truncate">
                  <bdi>{group.name ?? ui("owner.unnamedPlayers", locale)}</bdi>
                </span>
                <span className="type-caption">{uiCount("owner.games", group.games, locale)}</span>
              </span>
              <span className="type-strong shrink-0 text-owed">
                <LtrIsolate>{group.totalLabel}</LtrIsolate>
              </span>
              <ChevronDown
                aria-hidden
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              />
            </button>
            {open ? (
              <div id={panel} className="flex flex-col gap-2 border-t p-2">
                {group.debts.map((debt) => (
                  <DebtRow
                    key={debt.key}
                    row={debt.view}
                    mayCollect={mayCollect}
                    highlighted={false}
                    open={false}
                    onOpen={() => router.push(debt.href)}
                    locale={locale}
                  />
                ))}
                {group.reminderHref ? (
                  <a
                    href={group.reminderHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border px-4 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <MessageCircle aria-hidden className="size-4" />
                    {ui("owner.remindWhatsApp", locale)}
                  </a>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
