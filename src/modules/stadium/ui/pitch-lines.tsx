/**
 * A football pitch drawn in lines (outline, halfway line, centre circle and spot, both penalty and
 * goal areas) as an inline SVG. It takes the colour of the text around it (`currentColor`), so the
 * parent sets the stadium's accent and a low opacity. Decoration only: hidden from assistive tech,
 * no image file, scales to cover its box.
 */
export function PitchLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
    >
      <rect x="8" y="8" width="384" height="144" rx="4" />
      <line x1="200" y1="8" x2="200" y2="152" />
      <circle cx="200" cy="80" r="30" />
      <circle cx="200" cy="80" r="2" fill="currentColor" />
      <rect x="8" y="40" width="56" height="80" />
      <rect x="8" y="60" width="22" height="40" />
      <rect x="336" y="40" width="56" height="80" />
      <rect x="370" y="60" width="22" height="40" />
    </svg>
  );
}
