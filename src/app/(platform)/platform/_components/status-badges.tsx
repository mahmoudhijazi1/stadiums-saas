import { Badge } from "@/components/ui/badge";
import { ui } from "@/lib/copy";

/**
 * A stadium's status in words, never colour alone (DR-006): suspended uses the alert tokens,
 * overdue the owed tokens, active stays neutral. A suspended stadium that also owes shows both.
 */
export function StatusBadges({ status, overdue }: { status: "ACTIVE" | "SUSPENDED"; overdue: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {status === "SUSPENDED" ? (
        <Badge variant="outline" className="border-alert bg-alert-surface text-foreground">
          {ui("platform.statusSuspended", "en")}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          {ui("platform.statusActive", "en")}
        </Badge>
      )}
      {overdue ? (
        <Badge variant="outline" className="border-owed/60 bg-owed-subtle text-owed">
          {ui("platform.statusOverdue", "en")}
        </Badge>
      ) : null}
    </span>
  );
}
