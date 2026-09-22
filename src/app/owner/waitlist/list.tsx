import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { formatLocalRange, type HourCycle } from "@/app/owner/shared";
import { getCurrentTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

export async function OwnerWaitlist({
  locale = "ar",
}: {
  locale?: UiLocale;
}) {
  const tenant = await getCurrentTenant();
  const hourCycle: HourCycle = tenant.timeDisplay;
  const waitlist = await listOpenWaitlist();

  if (waitlist.length === 0) {
    return (
      <EmptyState
        title={ui("empty.waitlist", locale)}
        next={ui("empty.waitlistNext", locale)}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {waitlist.flatMap((group) =>
        group.people.map((person) => (
          <li key={`${group.pitchId}-${group.start.toISOString()}-${person.personId}`}>
            <Card>
              <CardHeader className="gap-1">
                <p className="text-sm font-medium leading-none">
                  {group.pitchName}
                </p>
                <CardDescription>
                  <LtrIsolate className="block">
                    {formatLocalRange(group.start, group.end, hourCycle)}
                  </LtrIsolate>
                  <span className="mt-1 block">
                    {person.name}{" "}
                    <LtrIsolate>{person.phone}</LtrIsolate>
                  </span>
                </CardDescription>
              </CardHeader>
              {person.whatsAppHref ? (
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={person.whatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ui("owner.notify", locale)}
                    </a>
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          </li>
        )),
      )}
    </ul>
  );
}
