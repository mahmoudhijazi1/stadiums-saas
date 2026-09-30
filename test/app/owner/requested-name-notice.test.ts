import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestedNameNotice } from "@/app/owner/requested-name-notice";

/** Security audit S-6: the request card shows the typed name only when it differs. */
function render(requestedName: string | null, locale: "ar" | "en") {
  return renderToStaticMarkup(createElement(RequestedNameNotice, { requestedName, locale }));
}

describe("RequestedNameNotice", () => {
  it("renders nothing when the typed name matched the saved one", () => {
    expect(render(null, "ar")).toBe("");
  });

  it("shows the Arabic warning with the typed name isolated", () => {
    const html = render("Sami", "ar");
    expect(html).toContain("الاسم يختلف عن المسجّل:");
    expect(html).toContain("<bdi>Sami</bdi>");
  });

  it("has English copy", () => {
    expect(render("سامي", "en")).toContain("Name differs from the saved one:");
  });
});
