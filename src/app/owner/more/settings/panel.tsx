import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CurrentMembership } from "@/modules/access/application/get-current-membership";
import { getCurrentRate } from "@/modules/payment/application/get-current-rate";
import { listPitchSummaries } from "@/modules/venue/application/list-pitch-summaries";
import type { UiLocale } from "@/lib/locale";
import { lbpPerUsdLine, ui } from "@/lib/ui-copy";
import { submitSetExchangeRate } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Exchange rate + pitch list. OWNER sees rate set + create/edit.
 * Staff see the current rate and pitch names, not the forms.
 */
export async function OwnerSettings({
  membership,
  tenantSlug,
  locale = "ar",
}: {
  membership: CurrentMembership;
  tenantSlug: string;
  locale?: UiLocale;
}) {
  const rate = await getCurrentRate();
  const pitches = await listPitchSummaries();
  const isOwner = membership.role === "OWNER";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {ui("owner.rate", locale)}
        </h3>
        <Card>
          <CardHeader>
            <CardDescription>
              {rate ? (
                lbpPerUsdLine(rate.toFixed(0), locale)
              ) : (
                ui("owner.noRate", locale)
              )}
            </CardDescription>
          </CardHeader>
          {isOwner ? (
            <CardContent>
              <form
                action={submitSetExchangeRate}
                className="flex flex-col gap-4"
              >
                <input type="hidden" name="tenant" value={tenantSlug} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lbpPerUsd">
                    {ui("owner.newRate", locale)}
                  </Label>
                  <Input
                    id="lbpPerUsd"
                    type="text"
                    name="lbpPerUsd"
                    required
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <SubmitButton variant="secondary" className="w-full">
                  {ui("owner.setRate", locale)}
                </SubmitButton>
              </form>
            </CardContent>
          ) : null}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {ui("owner.pitches", locale)}
          </h3>
          {isOwner ? (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={{
                  pathname: "/owner/more/settings/pitches/new",
                  query: { tenant: tenantSlug },
                }}
              >
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
                    <span className="block font-medium">{pitch.name}</span>
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
                  {isOwner ? (
                    <ChevronRight
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
                    />
                  ) : null}
                </>
              );
              return (
                <li key={pitch.id}>
                  {isOwner ? (
                    <Link
                      href={{
                        pathname: `/owner/more/settings/pitches/${pitch.id}`,
                        query: { tenant: tenantSlug },
                      }}
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
      </div>
    </section>
  );
}
