/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import { ui } from "@/lib/copy";

/** The status pages: one frame, Arabic first, never the error digest or message, tokens only. */
const noop = () => undefined;
const failure = Object.assign(new Error("secret detail"), { digest: "1234567890" });

describe("status pages", () => {
  it("error.tsx shows the frame, both languages and two actions, never the digest or the message", () => {
    const markup = renderToStaticMarkup(createElement(ErrorPage, { error: failure, retry: noop }));
    expect(markup).toContain("حدث خطأ غير متوقع");
    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("Try again");
    expect(markup).toContain("Go back");
    expect(markup).not.toContain("1234567890");
    expect(markup).not.toContain("secret detail");
    expect(markup).toContain("color-mix(in_oklab,var(--brand)_16%,var(--bg))");
  });

  it("not-found.tsx shows 404, the copy in both languages and a link home", () => {
    const markup = renderToStaticMarkup(createElement(NotFound));
    expect(markup).toContain(">404</p>");
    for (const locale of ["ar", "en"] as const) {
      expect(markup).toContain(ui("notFound.title", locale));
    }
    expect(markup).toMatch(/<a href="\/"[^>]*>/);
  });

  it("global-error.tsx never shows the digest or the message, and uses tokens, not raw colours", () => {
    // Code only: the doc comment says what the page never shows.
    const source = readFileSync(join(process.cwd(), "src", "app", "global-error.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source).not.toMatch(/digest\}|error\.message|#[0-9a-fA-F]{3,6}\b/);
    expect(source).toContain("StatusPage");
  });
});
