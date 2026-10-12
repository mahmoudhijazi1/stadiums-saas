import type { ComponentProps } from "react";

/**
 * The landing page's one column: up to 1120px with 20px of padding on each side. The app's own
 * Container is tuned for the owner screens (16px of padding on phones); the landing page is a
 * marketing page with its own measure.
 */
export function PageColumn({ className, ...props }: ComponentProps<"div">) {
  return <div className={`mx-auto w-full max-w-[1120px] px-5 ${className ?? ""}`} {...props} />;
}
