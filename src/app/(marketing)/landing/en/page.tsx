import type { Metadata } from "next";
import { ui } from "@/lib/copy";
import { LandingPlaceholder } from "@/app/(marketing)/landing/_components/landing-placeholder";
import { requireBareHost } from "@/app/(marketing)/landing/_components/require-bare-host";

/** English: the English landing page. Reached only through the proxy's rewrite from /en; noindex until the content slice. */
export const metadata: Metadata = {
  title: ui("landing.name", "en"),
  robots: { index: false, follow: false },
  manifest: null,
};

export default async function LandingPageEn() {
  await requireBareHost();
  return <LandingPlaceholder locale="en" />;
}
