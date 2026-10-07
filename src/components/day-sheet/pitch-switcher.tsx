import Link from "next/link";
import { cn } from "cn";

export type SwitcherItem = {
  id: string;
  href: string;
  /** "Pitch A1 · 2 free", translated. */
  label: string;
};

/** Two-segment switcher (the maximum). The selected pitch lives in the URL via the hrefs. */
export function PitchSwitcher({
  items,
  selectedId,
  label,
}: {
  items: SwitcherItem[];
  selectedId: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
      {items.map((item) => {
        const active = item.id === selectedId;
        return (
          <Link
            key={item.id}
            href={item.href}
            replace
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-full px-2 text-center text-sm font-medium outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active ? "bg-selected text-selected-ink" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
