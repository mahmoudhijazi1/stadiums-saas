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
      total: "120",
      hasMore: false,
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
  it("reads: To collect, the total, from earlier days, with the alert icon and the owed tokens", () => {
    const html = render();
    expect(text(html)).toBe("To collect $120 from earlier days");
    expect(html).toContain("text-owed");
    expect(html).toContain("bg-owed-subtle");
    expect(html).not.toContain("amber");
    expect(html).toContain('id="earlier-debts-heading"');
  });

  it("wraps by parts: three nowrap parts in a wrapping row", () => {
    const html = render({}, "ar");
    expect(html).toContain("flex-wrap");
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(3);
  });

  it("shows the exact total, without a +", () => {
    expect(text(render({ hasMore: false }))).not.toContain("+");
  });

  it("shows 'at least $X' when more rows are behind the capped total", () => {
    expect(text(render({ hasMore: true }))).toBe("To collect at least $120 from earlier days");
    expect(text(render({ hasMore: true }, "ar"))).toContain("على الأقل $120");
    expect(text(render({ hasMore: true }))).not.toContain("+");
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
