import type { Metadata } from "next";
import { requirePlatformHost } from "@/lib/require-platform-host";

/**
 * The platform admin frame (DR-006): the host guard first (404 off the bare host, whatever the
 * proxy did), noindex, and a plain English frame with no owner tab bar. Resolves no tenant.
 */
export const metadata: Metadata = {
  title: "Platform",
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformHost();
  return (
    <div dir="ltr" lang="en" className="min-h-svh">
      {children}
    </div>
  );
}
