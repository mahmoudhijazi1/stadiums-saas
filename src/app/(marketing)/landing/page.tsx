import type { Metadata } from "next";
import { LandingContent } from "@/app/(marketing)/landing/_components/landing-content";
import { landingMetadata } from "@/app/(marketing)/landing/_components/landing-metadata";
import { requireBareHost } from "@/app/(marketing)/landing/_components/require-bare-host";

/** The Arabic landing page. Reached only through the proxy's rewrite from /. Indexable. */
export function generateMetadata(): Metadata {
  return landingMetadata("ar");
}

export default async function LandingPage() {
  await requireBareHost();
  return <LandingContent locale="ar" />;
}
