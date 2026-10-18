import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicRequestView, type PublicRequestState } from "@/modules/booking/ui/public-request-view";
import {
  isFinalPublicRequestError,
  publicRequestErrorKind,
} from "@/modules/booking/domain/public-request-errors";
import { cancelUpToLine } from "@/lib/copy";

const slot = {
  startIso: "2026-10-16T17:00:00.000Z",
  endIso: "2026-10-16T18:00:00.000Z",
  startLocal: "8:00 PM",
  endLocal: "9:00 PM",
  price: { currency: "USD" as const, amount: "20.00" },
  available: true,
};

function render(state: PublicRequestState, over: Partial<Parameters<typeof PublicRequestView>[0]> = {}, locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(
    createElement(PublicRequestView, {
      state,
      pitchId: "p1",
      slot,
      dayLabel: "Fri 16",
      dateValue: "2026-10-16",
      locale,
      cancelLine: "Cancel up to 24 hours before.",
      feeLine: null,
      whatsappHref: "https://wa.me/96103111222",
      onSubmit: () => {},
      onClose: () => {},
      onAnother: () => {},
      ...over,
    }),
  );
}

/** The visible text: tags removed (numbers are wrapped in isolates). */
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("request sheet: the form", () => {
  const html = render({ step: "form", error: null, pending: false });

  it("has the existing fields, one primary button, the request note and the cancellation rule", () => {
    expect(html).toContain('name="name"');
    expect(html).toContain('maxLength="60"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('name="country"');
    expect(html).toContain("+961");
    expect(html).toContain('name="pitchId"');
    expect(html).toContain('name="date"');
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).toContain("Send request");
    expect(html).toContain("This is a request, not a confirmation. The owner will reply on WhatsApp.");
    expect(text(html)).toContain("Cancel up to 24 hours before.");
  });

  it("is in Arabic too, and disables the button while sending", () => {
    const ar = render({ step: "form", error: null, pending: false }, {}, "ar");
    expect(ar).toContain("أرسل الطلب");
    expect(ar).toContain("هذا طلب وليس تأكيداً");
    expect(render({ step: "form", error: null, pending: true })).toMatch(/<button[^>]*disabled/);
  });

  it("keeps the form for invalid input and too many requests, with a message", () => {
    const invalid = render({ step: "form", error: "invalid", pending: false });
    expect(invalid).toContain("Check your name and phone");
    expect(invalid).toContain('name="name"');
    expect(render({ step: "form", error: "limit", pending: false })).toContain("Too many requests");
  });
});

describe("request sheet: errors that end the try", () => {
  it("a taken time says the owner knows you are interested and offers another time", () => {
    const html = render({ step: "form", error: "taken", pending: false });
    expect(html).toContain("This time was just taken; the owner knows you&#x27;re interested.");
    expect(html).toContain("Pick another time");
    expect(html).not.toContain('name="phone"');
  });

  it("a day that is too far ahead is told so", () => {
    expect(render({ step: "form", error: "tooFar", pending: false })).toContain("too far ahead");
  });

  it("maps the use case keys to those kinds", () => {
    expect(publicRequestErrorKind("booking.slot_taken")).toBe("taken");
    expect(publicRequestErrorKind("booking.slot_taken_noted")).toBe("taken");
    expect(publicRequestErrorKind("booking.too_far")).toBe("tooFar");
    expect(publicRequestErrorKind("booking.request_limit")).toBe("limit");
    expect(publicRequestErrorKind("form.invalid")).toBe("invalid");
    expect(publicRequestErrorKind("error.generic")).toBe("other");
    expect(isFinalPublicRequestError("taken")).toBe(true);
    expect(isFinalPublicRequestError("limit")).toBe(false);
  });
});

describe("request sheet: sent", () => {
  const html = render({ step: "sent" });

  it("confirms the day and time, with a WhatsApp chat and a way to ask for another time", () => {
    expect(text(html)).toContain("Request sent for Fri 16 8:00 PM. The owner will confirm on WhatsApp.");
    expect(html).toContain('href="https://wa.me/96103111222"');
    expect(html).toContain("Request another time");
    expect(html).not.toContain('name="phone"');
  });

  it("shows no WhatsApp button when the stadium has no number", () => {
    expect(render({ step: "sent" }, { whatsappHref: null })).not.toContain("wa.me");
  });
});

describe("cancelUpToLine", () => {
  it("states the window, and nothing when there is none", () => {
    expect(cancelUpToLine(24, "en")).toBe("Cancel up to 24 hours before.");
    expect(cancelUpToLine(1, "en")).toBe("Cancel up to 1 hour before.");
    expect(cancelUpToLine(0, "en")).toBe("");
  });
});
