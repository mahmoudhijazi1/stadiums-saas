import type { ReactNode } from "react";
import { assertDevOnly } from "@/lib/dev-only";

/** Every route under /dev is a development tool: 404 in production, a new page included. */
export default function DevLayout({ children }: { children: ReactNode }) {
  assertDevOnly();
  return children;
}
