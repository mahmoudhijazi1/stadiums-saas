import type { Metadata } from "next";
import { LandingContent } from "@/app/(marketing)/landing/_components/landing-content";
import { landingMetadata } from "@/app/(marketing)/landing/_components/landing-metadata";
import { requireBareHost } from "@/app/(marketing)/landing/_components/require-bare-host";

/** The English landing page. Reached only through the proxy's rewrite from /en. Indexable. */
export function generateMetadata(): Metadata {
  return landingMetadata("en");
}

export default async function LandingPageEn() {
  await requireBareHost();
  return <LandingContent locale="en" />;
}
