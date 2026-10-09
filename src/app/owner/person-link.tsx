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
  prominent = false,
}: {
  personId: string;
  name: string;
  className?: string;
  /** The name as the heading of a sheet: strong size, ink colour, no underline (the chevron says it is a link). */
  prominent?: boolean;
}) {
  return (
    <Link
      href={`/owner/people/${personId}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex min-h-11 w-fit max-w-full items-center gap-1.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        prominent
          ? "type-strong text-foreground hover:text-action-ink"
          : "text-sm font-medium text-action-ink underline underline-offset-4",
        className,
      )}
    >
      {prominent ? null : <User aria-hidden className="size-4 shrink-0" />}
      <bdi className="truncate">{name}</bdi>
      <ChevronRight aria-hidden className={cn("shrink-0 rtl:rotate-180", prominent ? "size-4 text-muted-foreground" : "size-4")} />
    </Link>
  );
}
