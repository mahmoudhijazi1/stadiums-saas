import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EarlierDebtsHeader } from "@/modules/booking/ui/earlier-debts-header";

/** Written, not run. Today shows the owed-from-earlier-days total once, in the To collect header. */
function render(props: Partial<Parameters<typeof EarlierDebtsHeader>[0]> = {}, locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(
    createElement(EarlierDebtsHeader, {
      usd: "120.00",
      lbp: "0",
      locale,
      expandable: false,
      expanded: false,
      onToggle: () => {},
      ...props,
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("EarlierDebtsHeader", () => {
  it("reads: To collect over from earlier days, then the exact total, with the alert icon and the owed tokens", () => {
    const html = render();
    expect(text(html)).toBe("To collect from earlier days $120");
    expect(html).toContain("text-owed");
    expect(html).toContain("bg-card");
    expect(html).not.toContain("bg-owed-subtle");
    expect(html).not.toContain("amber");
    expect(html).toContain('id="earlier-debts-heading"');
  });

  it("always shows the exact total: never 'at least', never a +", () => {
    for (const locale of ["en", "ar"] as const) {
      const shown = text(render({ usd: "120.50" }, locale));
      expect(shown).toContain("$120.50");
      expect(shown).not.toContain("+");
      expect(shown).not.toContain("at least");
      expect(shown).not.toContain("على الأقل");
    }
  });

  it("splits the two currencies: pounds on one line, dollars on the next, each an LTR isolate, never added", () => {
    const html = render({ usd: "30.00", lbp: "2000000" });
    expect(text(html)).toBe("To collect from earlier days 2,000,000 LBP $30");
    expect(html.match(/<bdi dir="ltr"/g)).toHaveLength(2);
    expect(html).toContain("flex-col items-end");
  });

  it("shows only the currency that is owed", () => {
    expect(text(render({ usd: "0.00", lbp: "210000" }))).toBe("To collect from earlier days 210,000 LBP");
    expect(text(render({ usd: "30.00", lbp: "0" }))).toBe("To collect from earlier days $30");
  });

  it("the Arabic screen writes the same figures, digits then the unit, not a mirrored order", () => {
    const shown = text(render({ usd: "30.00", lbp: "2000000" }, "ar"));
    expect(shown).toContain("2,000,000");
    expect(shown.indexOf("2,000,000")).toBeLessThan(shown.indexOf("$30"));
    expect(shown).toMatch(/2,000,000 \S+ \$30/);
  });

  it("is a plain row for one debt and a toggle with a chevron for several", () => {
    const single = render();
    expect(single).not.toContain("<button");
    expect(single).not.toContain("aria-expanded");
    const several = render({ expandable: true, expanded: true });
    expect(several).toContain("<button");
    expect(several).toContain('aria-expanded="true"');
    expect(several).toContain('aria-controls="to-collect-list"');
    expect(several).toContain("rotate-180");
  });
});

describe("Today order", () => {
  const panel = readFileSync(join(process.cwd(), "src", "modules", "booking", "ui", "upcoming-panel.tsx"), "utf8");
  const lists = readFileSync(join(process.cwd(), "src", "app", "owner", "(app)", "today", "_components", "lists.tsx"), "utf8");

  it("puts the earlier-debts section before the games and the free strip", () => {
    const debts = panel.indexOf('id="earlier-debts"');
    expect(debts).toBeGreaterThan(-1);
    expect(debts).toBeLessThan(panel.indexOf('aria-labelledby="today-games-heading"'));
    expect(debts).toBeLessThan(panel.indexOf('key="free-strip"'));
    expect(panel.match(/id="earlier-debts"/g)).toHaveLength(1);
  });

  it("no longer has the separate owed pill on the page", () => {
    expect(lists).not.toContain('href="#earlier-debts"');
    expect(lists).not.toContain("owner.owedFromEarlier");
  });
});
