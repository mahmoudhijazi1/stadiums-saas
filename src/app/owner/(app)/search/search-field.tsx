"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/** Debounced query in the URL so results stay a Server Component. */
export function SearchField({
  locale,
  query,
}: {
  locale: UiLocale;
  query: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = value.trim();
      if (next === query) return;
      const href = next
        ? `/owner/search?q=${encodeURIComponent(next)}`
        : "/owner/search";
      router.replace(href);
    }, 300);
    return () => clearTimeout(handle);
  }, [value, query, router]);

  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={ui("owner.searchPlaceholder", locale)}
      aria-label={ui("owner.search", locale)}
      autoFocus
      className="text-base"
    />
  );
}
