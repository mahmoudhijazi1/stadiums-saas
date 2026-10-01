"use client";

import Link from "next/link";
import { ChevronRight, User } from "lucide-react";
import { cn } from "cn";

/**
 * The one link to a person page: person icon, name, chevron. Inline width (never a
 * full-row tap target) so it is not hit by accident, 44px tall, and it stops the click
 * so a card or row around it does not also open.
 */
export function PersonLink({
  personId,
  name,
  className,
}: {
  personId: string;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={`/owner/people/${personId}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex min-h-11 w-fit max-w-full items-center gap-1.5 rounded-md text-sm font-medium text-action-ink underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <User aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{name}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
    </Link>
  );
}
