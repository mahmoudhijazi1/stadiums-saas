import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PitchLines } from "@/modules/stadium/ui/pitch-lines";

describe("PitchLines", () => {
  const html = renderToStaticMarkup(createElement(PitchLines, { className: "text-accent-brand opacity-15" }));

  it("is an inline, decorative SVG in the colour of its parent, with no image file", () => {
    expect(html).toMatch(/^<svg/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toMatch(/<img|href=|url\(/);
    expect(html).toContain("text-accent-brand opacity-15");
  });

  it("draws the centre circle, the halfway line and the penalty areas", () => {
    expect(html.match(/<circle/g)).toHaveLength(2); // circle and spot
    expect(html).toContain("<line");
    expect(html.match(/<rect/g)).toHaveLength(5);
  });
});
