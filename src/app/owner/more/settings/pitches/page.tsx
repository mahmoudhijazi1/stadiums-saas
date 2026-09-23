import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OwnerBackLink } from "@/app/owner/back-link";
import { requireOwnerMembership } from "@/app/owner/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { listPitchSummaries } from "@/modules/venue/application/list-pitch-summaries";

/**
 * Pitch list. Create and edit stay on the routes under this folder.
 */
export default async function PitchListPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();
  const pitches = await listPitchSummaries();
  const mayManage = can(membership, SETTINGS_MANAGE);

  return (
    <section className="flex flex-col gap-4">
      <OwnerBackLink href="/owner/more" locale={locale} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-3xl lg:text-4xl">
          {ui("owner.pitches", locale)}
        </h2>
        {mayManage ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/owner/more/settings/pitches/new">
              {ui("owner.pitchNew", locale)}
            </Link>
          </Button>
        ) : null}
      </div>
      {pitches.length === 0 ? (
        <EmptyState
          title={ui("empty.pitches", locale)}
          next={ui("empty.pitchesNext", locale)}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {pitches.map((pitch) => {
            const body = (
              <>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{pitch.name}</span>
                  {pitch.hoursGroups.length === 0 &&
                  pitch.closedDays.length === 7 ? (
                    <span className="block text-sm text-muted-foreground">
                      {ui("owner.pitchAllClosed", locale)}
                    </span>
                  ) : (
                    <span className="block text-sm text-muted-foreground">
                      {pitch.hoursGroups.map((group) => (
                        <span key={group.days.join("-")} className="block">
                          <LtrIsolate>
                            {`${group.open}–${group.close}`}
                          </LtrIsolate>
                          {" · "}
                          {group.days
                            .map((day) => ui(`owner.wd.${day}`, locale))
                            .join(" · ")}
                        </span>
                      ))}
                      {pitch.closedDays.length > 0 ? (
                        <span className="block">
                          {pitch.closedDays
                            .map(
                              (day) =>
                                `${ui(`owner.wd.${day}`, locale)}: ${ui("owner.pitchClosed", locale)}`,
                            )
                            .join(" · ")}
                        </span>
                      ) : null}
                      <span className="block">
                        <LtrIsolate>
                          {`${pitch.slotDurationMinutes} ${ui("owner.pitchMinutes", locale)} · $${pitch.defaultPriceUsd}`}
                        </LtrIsolate>
                      </span>
                    </span>
                  )}
                </span>
                {mayManage ? (
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
                  />
                ) : null}
              </>
            );
            return (
              <li key={pitch.id}>
                {mayManage ? (
                  <Link
                    href={`/owner/more/settings/pitches/${pitch.id}`}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
