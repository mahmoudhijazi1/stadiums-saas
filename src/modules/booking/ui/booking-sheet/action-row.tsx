import type { ComponentType, ReactNode, Ref } from "react";
import { cn } from "cn";

/** One line of "More actions": a list row in a grouped card (body role, 56px, leading icon). */
export function ActionRow({
  icon: Icon,
  onClick,
  destructive = false,
  disabled = false,
  hint,
  buttonRef,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onClick: () => void;
  destructive?: boolean;
  /** Not possible now; `hint` says why. */
  disabled?: boolean;
  hint?: string | null;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 px-4 type-body text-start outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
        destructive && "text-destructive",
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-col">
        {children}
        {hint ? <span className="type-caption">{hint}</span> : null}
      </span>
    </button>
  );
}
