import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { ui } from "@/lib/ui-copy";
import { formatLocalRange } from "@/app/owner/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

export async function OwnerWaitlist() {
  const waitlist = await listOpenWaitlist();

  if (waitlist.length === 0) {
    return (
      <EmptyState
        title={ui("empty.waitlist")}
        next={ui("empty.waitlistNext")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {waitlist.map((group) => (
        <li key={`${group.pitchId}-${group.start.toISOString()}`}>
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">{group.pitchName}</CardTitle>
              <CardDescription>
                <LtrIsolate>
                  {formatLocalRange(group.start, group.end)}
                </LtrIsolate>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {group.people.map((person) => (
                  <li
                    key={person.personId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p>{person.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <LtrIsolate>{person.phone}</LtrIsolate>
                      </p>
                    </div>
                    {person.whatsAppHref ? (
                      <Button variant="outline" asChild>
                        <a
                          href={person.whatsAppHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {ui("owner.notify")}
                        </a>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
