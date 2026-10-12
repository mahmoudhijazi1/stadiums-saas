/** The LebStads mark, drawn with the app's tokens (the accent fill and the ink on it), so it follows both themes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <rect x="14" y="10" width="10" height="44" rx="2" className="fill-primary-foreground" />
      <rect x="14" y="44" width="40" height="10" rx="2" className="fill-primary-foreground" />
      <path d="M24 31 A13 13 0 0 1 37 44" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary-foreground" />
    </svg>
  );
}
