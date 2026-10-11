/**
 * How much of the stadium's accent tints the top of the public page. 10% is the most the muted
 * text (--ink-muted) can sit on in the light theme and still reach 4.5:1 for every accent preset
 * (test/app/public/header-contrast.test.ts holds the numbers; 12% already fails for the darkest).
 */
export const HEADER_TINT_PERCENT = 10;

/**
 * The page-top backdrop: a soft vertical gradient from a low-opacity tint of the accent (--brand)
 * to the page background (--bg). No frame, no border; both ends follow the theme.
 */
export function headerGradient(): string {
  return `linear-gradient(to bottom, color-mix(in oklab, var(--brand) ${HEADER_TINT_PERCENT}%, var(--bg)), var(--bg))`;
}

/**
 * One decorative arc: a quarter of a football pitch's centre circle, cropped by its own box and
 * meant for the end corner (it mirrors in RTL). It takes the colour of its parent (`currentColor`),
 * so the parent sets the accent and a very low opacity. It is a box of its own: the caller puts it
 * beside the text, never behind it. Decoration only: hidden from assistive tech, no image file.
 */
export function PitchArc({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 96 96"
      className={`overflow-hidden rtl:-scale-x-100 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="96" cy="96" r="72" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
