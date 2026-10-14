/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelpList } from "@/app/owner/(app)/more/help/_components/help-list";
import {
  HELP_GROUPS,
  topicCopyKeys,
  visibleHelpGroups,
} from "@/app/owner/(app)/more/help/_components/topics";
import { landingWhatsAppHref, LEBSTADS_WHATSAPP } from "@/app/(marketing)/landing/_components/landing-contact";
import { ui } from "@/lib/copy";
import { COPY_AREAS } from "@/lib/copy/ui";
import { SUPPORT_WHATSAPP } from "@/lib/support-contact";
import { REPORTS_VIEW } from "@/modules/access/domain/can";

/** More > Help: copy in both languages, real routes, permission filtering, closed topics, shared number. */
const ROOT = process.cwd();
const ALL_TOPICS = HELP_GROUPS.flatMap((group) => group.topics);
const OWNER = { role: "OWNER" as const, permissions: {} };
const MONEY_REPORT_TOPICS = ["owed", "moneyPage", "shopReport"];

function inTable(key: string, locale: "ar" | "en"): boolean {
  return Object.values(COPY_AREAS).some((area) => typeof area[locale][key] === "string");
}

/** An owner href is a page under src/app/owner (inside the (app) group or beside it). */
function routeExists(href: string): boolean {
  const rest = href.replace(/^\/owner/, "").split("?")[0] ?? "";
  return [join(ROOT, "src/app/owner/(app)", rest, "page.tsx"), join(ROOT, "src/app/owner", rest, "page.tsx")].some((file) =>
    existsSync(file),
  );
}

function visibleIds(membership: { role: "OWNER" | "STAFF"; permissions: unknown }, pushOn = true): string[] {
  return visibleHelpGroups(membership, { pushOn }).flatMap((group) => group.topics.map((topic) => topic.id));
}

describe("Help topics", () => {
  it("has about eight to ten groups and unique topic ids", () => {
    expect(HELP_GROUPS.length).toBeGreaterThanOrEqual(8);
    expect(HELP_GROUPS.length).toBeLessThanOrEqual(10);
    const ids = ALL_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has Arabic and English copy for every group, topic line and label", () => {
    const keys = [
      "owner.help",
      "help.intro",
      "help.where",
      "help.goodToKnow",
      "help.stuck",
      "help.whatsappMessage",
      ...HELP_GROUPS.map((group) => `help.group.${group.id}`),
      ...ALL_TOPICS.flatMap(topicCopyKeys),
    ];
    const missing = keys.flatMap((key) =>
      (["ar", "en"] as const).filter((locale) => !inTable(key, locale)).map((locale) => `${key} (${locale})`),
    );
    expect(missing).toEqual([]);
  });

  it("keeps steps to three at most", () => {
    for (const topic of ALL_TOPICS) expect(topic.steps).toBeLessThanOrEqual(3);
  });

  it("points every Where link to a route that exists under src/app", () => {
    const broken = ALL_TOPICS.filter((topic) => topic.href && !routeExists(topic.href)).map((topic) => `${topic.id}: ${topic.href}`);
    expect(broken).toEqual([]);
  });

  it("shows an owner every topic", () => {
    expect(visibleIds(OWNER)).toEqual(ALL_TOPICS.map((topic) => topic.id));
  });

  it("hides the money report topics from STAFF without reports.view, and shows them with it", () => {
    const without = visibleIds({ role: "STAFF", permissions: {} });
    for (const id of MONEY_REPORT_TOPICS) expect(without).not.toContain(id);
    const withFlag = visibleIds({ role: "STAFF", permissions: { [REPORTS_VIEW]: true } });
    for (const id of MONEY_REPORT_TOPICS) expect(withFlag).toContain(id);
  });

  it("hides owner-only topics from STAFF whatever their flags", () => {
    const staff = visibleIds({ role: "STAFF", permissions: { "shop.manage": true, "people.edit": true } });
    expect(staff).not.toContain("catalog");
    expect(staff).not.toContain("editPerson");
  });

  it("hides Notifications when push is not configured", () => {
    expect(visibleIds(OWNER, false)).not.toContain("notifications");
    expect(visibleIds(OWNER, true)).toContain("notifications");
  });
});

describe("Help page markup", () => {
  for (const locale of ["ar", "en"] as const) {
    const markup = renderToStaticMarkup(
      createElement(HelpList, {
        groups: visibleHelpGroups(OWNER, { pushOn: true }),
        locale,
        supportHref: "https://wa.me/96178862587?text=hello",
      }),
    );

    it(`${locale}: renders every topic as a closed native disclosure`, () => {
      expect(markup.match(/<details /g)?.length).toBe(ALL_TOPICS.length);
      expect(markup).not.toMatch(/<details[^>]*\sopen/);
      for (const group of HELP_GROUPS) expect(markup).toContain(ui(`help.group.${group.id}`, locale));
    });

    it(`${locale}: links Where to the real screens and ends with the WhatsApp support line`, () => {
      expect(markup).toContain('href="/owner/requests"');
      expect(markup).toContain('href="https://wa.me/96178862587?text=hello"');
      expect(markup).toContain(ui("help.stuck", locale));
    });

    it(`${locale}: LTR-isolates the numbers in the copy`, () => {
      expect(markup).toContain('<bdi dir="ltr" class="tabular-nums">30</bdi>');
    });
  }

  it("needs no client JavaScript (no use client in the route)", () => {
    for (const file of ["page.tsx", "_components/help-list.tsx", "_components/topics.ts"]) {
      expect(read(`src/app/owner/(app)/more/help/${file}`)).not.toContain("use client");
    }
  });
});

describe("More menu and the support number", () => {
  it("has a Help row in the More hub", () => {
    const hub = read("src/app/owner/(app)/more/_components/hub.tsx");
    expect(hub).toContain('label={ui("owner.help", locale)} href="/owner/more/help"');
  });

  it("keeps the landing page on the same WhatsApp number, from the shared constant", () => {
    expect(SUPPORT_WHATSAPP).toBe("96178862587");
    expect(LEBSTADS_WHATSAPP).toBe(SUPPORT_WHATSAPP);
    expect(landingWhatsAppHref("ar").startsWith("https://wa.me/96178862587?text=")).toBe(true);
    expect(read("src/app/(marketing)/landing/_components/landing-contact.ts")).toContain("@/lib/support-contact");
  });
});

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}
