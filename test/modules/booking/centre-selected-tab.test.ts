import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { keepSelectedTabCentred } from "@/modules/booking/ui/centre-selected-tab";

/** Written, not run. The strip re-centres after fonts.ready and after a resize; the browser is mocked. */
type Box = { left: number; width: number };

function makeList(tabBox: Box, listBox: Box) {
  const scrollBy = jest.fn();
  const tab = { getBoundingClientRect: () => tabBox };
  const list = {
    querySelector: () => tab,
    getBoundingClientRect: () => listBox,
    scrollBy,
  };
  return { list: list as unknown as HTMLElement, scrollBy, tabBox, listBox };
}

const globals = globalThis as Record<string, unknown>;
let resizeCallback: (() => void) | null = null;
const disconnect = jest.fn();
const observe = jest.fn();

beforeEach(() => {
  resizeCallback = null;
  disconnect.mockClear();
  observe.mockClear();
  globals.ResizeObserver = class {
    constructor(callback: () => void) {
      resizeCallback = callback;
    }
    observe = observe;
    disconnect = disconnect;
  };
});

afterEach(() => {
  delete globals.ResizeObserver;
  delete globals.document;
});

describe("keepSelectedTabCentred", () => {
  it("centres at once: the shift is the distance between the two centres, behaviour auto", () => {
    globals.document = {};
    const { list, scrollBy } = makeList({ left: 300, width: 60 }, { left: 0, width: 200 });
    keepSelectedTabCentred(list);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ left: 230, behavior: "auto" });
  });

  it("centres again after document.fonts.ready, with the new widths", async () => {
    let ready!: () => void;
    globals.document = { fonts: { ready: new Promise<void>((resolve) => (ready = resolve)) } };
    const { list, scrollBy, tabBox } = makeList({ left: 300, width: 60 }, { left: 0, width: 200 });
    keepSelectedTabCentred(list);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    tabBox.width = 100; // the font arrived and the tab grew
    ready();
    await Promise.resolve();
    await Promise.resolve();
    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 250, behavior: "auto" });
  });

  it("centres again when the list is resized, and stops after the cleanup", () => {
    globals.document = {};
    const { list, scrollBy, listBox } = makeList({ left: 300, width: 60 }, { left: 0, width: 200 });
    const stop = keepSelectedTabCentred(list);
    expect(observe).toHaveBeenCalledWith(list);
    listBox.width = 400;
    resizeCallback!();
    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 130, behavior: "auto" });
    stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not centre after fonts.ready once cleaned up", async () => {
    let ready!: () => void;
    globals.document = { fonts: { ready: new Promise<void>((resolve) => (ready = resolve)) } };
    const { list, scrollBy } = makeList({ left: 300, width: 60 }, { left: 0, width: 200 });
    const stop = keepSelectedTabCentred(list);
    stop();
    ready();
    await Promise.resolve();
    await Promise.resolve();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("works without document.fonts and without ResizeObserver", () => {
    globals.document = {};
    delete globals.ResizeObserver;
    const { list, scrollBy } = makeList({ left: 300, width: 60 }, { left: 0, width: 200 });
    expect(() => keepSelectedTabCentred(list)()).not.toThrow();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });
});
