"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog. Hidden in print CSS (`print:hidden`). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" className="gap-2 print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden className="size-4" />
      {label}
    </Button>
  );
}
