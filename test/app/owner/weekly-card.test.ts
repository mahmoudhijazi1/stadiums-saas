import { describe, expect, it, jest } from "@jest/globals";
import type { ReactElement, ReactNode } from "react";
import { WeeklyCard, type WeeklyItem } from "@/app/owner/(app)/more/weekly/_components/weekly-card";

/**
 * Written, not run. There is no DOM here, so the card (a plain function component) is called and
 * its element tree walked: every element with an onClick is a tap target, and "tapping" it calls
 * that handler. A tap on Renew reaches only Renew because it is a sibling of the card button, not
 * a child of it.
 */
const ITEM: WeeklyItem = { seriesId: "s1", personName: "Hassan", when: "Every Tue 8:00 PM", pitchName: null, left: 3 };

type Node = ReactElement<{ children?: ReactNode; onClick?: () => void }>;
type Target = { element: Node; insideOtherTarget: boolean };

function targets(node: ReactNode, inside = false, found: Target[] = []): Target[] {
  if (Array.isArray(node)) {
    for (const child of node) targets(child, inside, found);
  } else if (node && typeof node === "object" && "props" in node) {
    const element = node as Node;
    const clickable = typeof element.props.onClick === "function";
    if (clickable) found.push({ element, insideOtherTarget: inside });
    targets(element.props.children, inside || clickable, found);
  }
  return found;
}

function render(mayRenew: boolean) {
  const onOpen = jest.fn();
  const onRenew = jest.fn();
  const tree = WeeklyCard({ item: ITEM, mayRenew, locale: "en", onOpen, onRenew }) as unknown as Node;
  return { onOpen, onRenew, found: targets(tree) };
}

describe("WeeklyCard", () => {
  it("tapping the card opens the series sheet for that series", () => {
    const { onOpen, onRenew, found } = render(true);
    found[0]!.element.props.onClick!();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(ITEM);
    expect(onRenew).not.toHaveBeenCalled();
  });

  it("tapping Renew does only Renew", () => {
    const { onOpen, onRenew, found } = render(true);
    expect(found).toHaveLength(2);
    found[1]!.element.props.onClick!();
    expect(onRenew).toHaveBeenCalledTimes(1);
    expect(onRenew).toHaveBeenCalledWith(ITEM);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("Renew is not inside the card button, so a tap on it cannot also reach the card", () => {
    const { found } = render(true);
    expect(found.map((target) => target.insideOtherTarget)).toEqual([false, false]);
  });

  it("without the permission there is only the card button", () => {
    const { found } = render(false);
    expect(found).toHaveLength(1);
  });
});
