import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Container } from "@/components/ui/container";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

/**
 * Migration Phase 1 — token palette preview. Not product chrome.
 * Visit on a tenant host: /dev/palette
 */
export default async function PalettePage() {
  const locale = await getUiLocale();

  const surfaces = [
    { role: "bg", className: "bg-bg text-ink" },
    { role: "surface", className: "bg-surface text-ink border border-line" },
    { role: "surface-2", className: "bg-surface-2 text-ink" },
    { role: "inverse", className: "bg-inverse text-inverse-ink" },
    { role: "accent", className: "bg-accent-brand text-accent-ink" },
    { role: "selected", className: "bg-selected text-selected-ink" },
    { role: "alert", className: "bg-alert text-accent-ink" },
    { role: "success", className: "bg-success text-accent-ink" },
    { role: "deep", className: "bg-deep text-inverse-ink" },
  ] as const;

  return (
    <Container className="flex flex-col gap-8 bg-bg py-8 text-ink">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold lg:text-4xl">
            Tokens
          </h1>
          <LangToggle locale={locale} />
        </div>
        <ThemeToggle locale={locale} />
        <p className="text-sm text-ink-muted">
          {ui("theme.label", locale)} · Phase 1 · {locale.toUpperCase()}
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Colour roles">
        <h2 className="font-display text-xl font-extrabold">Colour roles</h2>
        <ul className="grid grid-cols-2 gap-2">
          {surfaces.map((swatch) => (
            <li
              key={swatch.role}
              className={`flex min-h-20 flex-col justify-end rounded-[var(--radius-card)] p-3 ${swatch.className}`}
            >
              <span className="font-mono text-xs opacity-80">{swatch.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-label="Ink">
        <h2 className="font-display text-xl font-extrabold">Ink</h2>
        <p className="text-base text-ink">ink — primary body</p>
        <p className="text-sm text-ink-muted">ink-muted — captions</p>
        <p className="font-display text-4xl font-extrabold tabular-nums">
          16:00 · $40
        </p>
        <p className="font-sans text-sm">
          Arabic UI: ملاعب —{" "}
          <span className="font-display tabular-nums" dir="ltr">
            12:30
          </span>
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-label="Lines">
        <h2 className="font-display text-xl font-extrabold lg:text-2xl">Lines</h2>
        <div className="h-px bg-line" />
        <div className="h-px bg-line-strong" />
        <div
          className="h-16 rounded-[var(--radius-sheet)] border-2 border-dashed"
          style={{ borderColor: "var(--line-dashed)" }}
        />
      </section>
    </Container>
  );
}
