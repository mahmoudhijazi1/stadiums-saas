import type { Metadata } from "next";

/**
 * The platform admin (DR-006), slice 3: a placeholder. `src/proxy.ts` serves /platform only on the
 * bare host, so this page never resolves a tenant (it imports nothing from tenant-context). Slice 4
 * replaces it with the login. Dynamic, so it is never prerendered or cached.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform",
  robots: { index: false, follow: false },
};

export default function PlatformPage() {
  return <main>Platform</main>;
}
