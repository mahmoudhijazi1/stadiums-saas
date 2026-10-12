import type { ReactNode } from "react";

/**
 * Simple phone mock-ups for the six features: shapes drawn with the app's colour tokens (Tailwind
 * fill and stroke utilities), no screenshots and no text to translate. Decorative: hidden from
 * assistive technology; the feature's heading and text carry the meaning.
 */
function Phone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 200" aria-hidden="true" focusable="false" className="mx-auto h-36 w-auto sm:h-48">
      <rect x="2" y="2" width="116" height="196" rx="16" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="44" y="8" width="32" height="5" rx="2.5" className="fill-muted" />
      {children}
    </svg>
  );
}

/** A public booking page: day pills, free times and a QR code. */
function BookingPage() {
  const qr = [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1];
  return (
    <>
      <rect x="14" y="22" width="92" height="14" rx="4" className="fill-muted" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={14 + i * 32} y="42" width="28" height="12" rx="6" className={i === 1 ? "fill-primary" : "fill-muted"} />
      ))}
      {[0, 1].map((i) => (
        <rect key={i} x="14" y={62 + i * 18} width="92" height="14" rx="4" className="fill-muted" />
      ))}
      {qr.map((on, i) => (
        <rect key={i} x={40 + (i % 5) * 8} y={104 + Math.floor(i / 5) * 8} width="7" height="7" rx="1" className={on ? "fill-foreground" : "fill-muted"} />
      ))}
      <rect x="14" y="156" width="92" height="28" rx="6" className="fill-primary" />
    </>
  );
}

/** A request card with a one-tap approve button and an alert dot. */
function Approve() {
  return (
    <>
      <circle cx="98" cy="30" r="6" className="fill-primary" />
      <rect x="14" y="48" width="92" height="64" rx="8" className="fill-muted" />
      <rect x="22" y="58" width="52" height="7" rx="3" className="fill-muted-foreground" />
      <rect x="22" y="72" width="36" height="7" rx="3" className="fill-border" />
      <rect x="22" y="86" width="44" height="7" rx="3" className="fill-border" />
      <rect x="14" y="124" width="92" height="30" rx="8" className="fill-primary" />
      <path d="M50 139 L58 147 L72 131" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground" />
    </>
  );
}

/** Two payment rows, one in dollars and one in pounds, and the change. */
function Payments() {
  return (
    <>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x="14" y={36 + i * 40} width="92" height="32" rx="8" className="fill-muted" />
          <circle cx="32" cy={52 + i * 40} r="9" className="fill-primary" />
          <rect x="48" y={46 + i * 40} width="42" height="7" rx="3" className="fill-muted-foreground" />
          <rect x="48" y={58 + i * 40} width="28" height="6" rx="3" className="fill-border" />
        </g>
      ))}
      <rect x="14" y="124" width="92" height="12" rx="6" className="fill-border" />
      <rect x="14" y="156" width="92" height="28" rx="6" className="fill-primary" />
    </>
  );
}

/** A week grid with the same slot filled on the same day, week after week. */
function Weekly() {
  return (
    <>
      <rect x="14" y="22" width="92" height="12" rx="4" className="fill-muted" />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) => (
          <rect key={`${row}-${col}`} x={14 + col * 13.5} y={44 + row * 24} width="11" height="20" rx="3" className={col === 2 ? "fill-primary" : "fill-muted"} />
        )),
      )}
    </>
  );
}

/** Canteen items and a player's tab. */
function Tabs() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="14" y={30 + i * 34} width="92" height="28" rx="8" className="fill-muted" />
          <circle cx="30" cy={44 + i * 34} r="8" className={i === 0 ? "fill-primary" : "fill-border"} />
          <rect x="44" y={38 + i * 34} width="34" height="6" rx="3" className="fill-muted-foreground" />
          <rect x="44" y={48 + i * 34} width="22" height="5" rx="2.5" className="fill-border" />
          <rect x="84" y={39 + i * 34} width="16" height="10" rx="5" className="fill-card" />
        </g>
      ))}
      <rect x="14" y="140" width="92" height="40" rx="8" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="22" y="150" width="40" height="7" rx="3" className="fill-muted-foreground" />
      <rect x="22" y="164" width="60" height="8" rx="4" className="fill-primary" />
    </>
  );
}

/** The money page: bars for in and out and a profit line. */
function Money() {
  return (
    <>
      <rect x="14" y="24" width="92" height="30" rx="8" className="fill-muted" />
      <rect x="22" y="34" width="36" height="9" rx="4" className="fill-primary" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={18 + i * 18} y={150 - (28 + i * 10)} width="7" height={28 + i * 10} rx="2" className="fill-primary" />
          <rect x={27 + i * 18} y={150 - (20 + (i % 3) * 8)} width="7" height={20 + (i % 3) * 8} rx="2" className="fill-border" />
        </g>
      ))}
      <rect x="14" y="160" width="92" height="3" rx="1.5" className="fill-border" />
      <rect x="14" y="170" width="60" height="8" rx="4" className="fill-muted" />
    </>
  );
}

export const FEATURE_MOCKUPS: ReactNode[] = [
  <Phone key="booking"><BookingPage /></Phone>,
  <Phone key="approve"><Approve /></Phone>,
  <Phone key="payments"><Payments /></Phone>,
  <Phone key="weekly"><Weekly /></Phone>,
  <Phone key="tabs"><Tabs /></Phone>,
  <Phone key="money"><Money /></Phone>,
];
