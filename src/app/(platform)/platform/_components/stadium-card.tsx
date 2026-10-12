import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ui } from "@/lib/copy";
import { StatusBadges } from "@/app/(platform)/platform/_components/status-badges";

export type StadiumCardView = {
  slug: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  overdue: boolean;
  plan: string | null;
  paidUntil: string | null;
  pitchCount: number;
  bookingsLast30Days: number;
};

/** One stadium in the list: the whole card is the link to its detail page. */
export function StadiumCard({ stadium }: { stadium: StadiumCardView }) {
  const none = ui("platform.none", "en");
  return (
    <Link
      href={`/platform/stadiums/${stadium.slug}`}
      className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-base font-semibold">
            <bdi>{stadium.name}</bdi>
          </span>
          <StatusBadges status={stadium.status} overdue={stadium.overdue} />
        </span>
        <span dir="ltr" className="text-start text-sm text-muted-foreground">
          {stadium.slug}
        </span>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-muted-foreground">{ui("platform.plan", "en")}</dt>
          <dd>{stadium.plan ?? none}</dd>
          <dt className="text-muted-foreground">{ui("platform.paidUntil", "en")}</dt>
          <dd className="tabular-nums">{stadium.paidUntil ?? none}</dd>
          <dt className="text-muted-foreground">{ui("platform.pitches", "en")}</dt>
          <dd className="tabular-nums">{stadium.pitchCount}</dd>
          <dt className="text-muted-foreground">{ui("platform.bookings30", "en")}</dt>
          <dd className="tabular-nums">{stadium.bookingsLast30Days}</dd>
        </dl>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
