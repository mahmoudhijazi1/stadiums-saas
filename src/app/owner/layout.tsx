import type { Metadata } from "next";

/** The owner app is private: no search engine should list a login or an owner page. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
