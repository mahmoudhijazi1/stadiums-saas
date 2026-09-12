"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Home-style tap disclosure. Closed by default so the number/list
 * stays in the fold. Client only for the open flag.
 */
export function Reveal({
  closedLabel,
  openLabel,
  children,
}: {
  closedLabel: string;
  openLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? openLabel : closedLabel}
      </Button>
      {open ? children : null}
    </div>
  );
}
