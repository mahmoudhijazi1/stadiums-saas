import { cn } from "cn";

/**
 * The classes of one day chip (public page and owner Book). Its own file so the Stadium info
 * preview renders the very same pill the app does, without importing the server-side strip.
 */
export function dayChipClass(selected: boolean): string {
  return cn(
    "flex h-14 w-full min-w-0 flex-col items-center justify-center rounded-[var(--radius-md)] border px-1 py-1.5 text-xs outline-none",
    "transition-[background-color,color,border-color] duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
    selected
      ? "border-transparent bg-selected text-selected-ink"
      : "border-line bg-surface text-ink hover:bg-surface-2",
  );
}
