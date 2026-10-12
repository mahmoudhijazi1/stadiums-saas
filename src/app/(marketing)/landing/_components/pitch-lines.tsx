/**
 * Half a football pitch in thin lines (touchline, halfway line, centre circle and spot, penalty and
 * goal areas, the penalty arc): the landing page's background shape. It takes the colour of its
 * parent (currentColor), so the parent sets a token and a very low opacity. Decoration only.
 */
export function PitchLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 520" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <rect x="10" y="10" width="380" height="500" rx="6" />
      <line x1="10" y1="10" x2="390" y2="10" />
      <circle cx="200" cy="10" r="70" />
      <circle cx="200" cy="10" r="4" fill="currentColor" />
      <rect x="90" y="374" width="220" height="136" />
      <rect x="145" y="460" width="110" height="50" />
      <circle cx="200" cy="420" r="4" fill="currentColor" />
      <path d="M150 374 A62 62 0 0 1 250 374" />
    </svg>
  );
}
