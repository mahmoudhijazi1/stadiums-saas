import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useBrowserOrigin } from "@/lib/use-browser-origin";
import { useMounted } from "@/lib/use-mounted";

/** Written, not run. On the server (and while hydrating) both hooks give their server snapshot. */
describe("browser-only hooks", () => {
  it("useMounted is false on the server", () => {
    const Probe = () => createElement("span", null, String(useMounted()));
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>false</span>");
  });

  it("useBrowserOrigin is empty on the server", () => {
    const Probe = () => createElement("span", null, `[${useBrowserOrigin()}]`);
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>[]</span>");
  });
});
