import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HEADER_TINT_PERCENT, PitchArc, headerGradient } from "@/modules/stadium/ui/pitch-arc";

describe("PitchArc", () => {
  const html = renderToStaticMarkup(createElement(PitchArc, { className: "text-accent-brand opacity-30" }));

  it("is one inline decorative arc in the colour of its parent, mirrored in RTL, no image file", () => {
    expect(html).toMatch(/^<svg/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain("rtl:-scale-x-100");
    expect(html.match(/<circle/g)).toHaveLength(1);
    expect(html).not.toMatch(/<img|href=|url\(/);
  });
});

describe("headerGradient", () => {
  it("runs from a low tint of the accent to the page background, in the theme's own variables", () => {
    const css = headerGradient();
    expect(css).toBe(`linear-gradient(to bottom, color-mix(in oklab, var(--brand) ${HEADER_TINT_PERCENT}%, var(--bg)), var(--bg))`);
    expect(HEADER_TINT_PERCENT).toBeLessThanOrEqual(15);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
