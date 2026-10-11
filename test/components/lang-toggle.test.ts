import { describe, expect, it, jest } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LangSegmented, switchLocale } from "@/components/shell/lang-toggle";

const html = (current: "ar" | "en") => renderToStaticMarkup(createElement(LangSegmented, { current, onSelect: () => {} }));

describe("LangSegmented", () => {
  it("shows both options, in a labelled group, and marks only the current one", () => {
    const en = html("en");
    expect(en).toContain('role="group"');
    expect(en).toContain('aria-label="Language / اللغة"');
    expect(en).toContain("عربي");
    expect(en).toContain(">EN<");
    expect(en.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(en).toMatch(/aria-pressed="true"[^>]*>EN</);
    expect(html("ar")).toMatch(/aria-pressed="true"[^>]*>عربي</);
  });

  it("moves the pill by transform only, with no motion under reduced motion", () => {
    expect(html("en")).toContain("translate-x-full");
    expect(html("ar")).not.toContain("translate-x-full");
    expect(html("ar")).toContain("motion-reduce:transition-none");
    expect(html("ar")).toContain("transition-transform");
  });

  it("gives each option a 44px hit area", () => {
    expect(html("ar").match(/h-11 min-w-11/g)).toHaveLength(2);
  });
});

describe("switchLocale", () => {
  it("sets lang and dir, calls the action with the other locale, then only refreshes (same path and query)", async () => {
    const root = { lang: "ar", dir: "rtl" };
    const action = jest.fn(async (_value: string) => "en");
    const refresh = jest.fn();
    await switchLocale({ next: "en", current: "ar", onChangeLocale: action, root, refresh });
    expect(action).toHaveBeenCalledWith("en");
    expect(root).toEqual({ lang: "en", dir: "ltr" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the chosen language is already current", async () => {
    const action = jest.fn(async (_value: string) => "ar");
    const refresh = jest.fn();
    await switchLocale({ next: "ar", current: "ar", onChangeLocale: action, root: { lang: "ar", dir: "rtl" }, refresh });
    expect(action).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
