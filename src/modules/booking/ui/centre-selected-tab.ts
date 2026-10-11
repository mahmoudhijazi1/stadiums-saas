/** Scrolls the list so the selected tab sits in its middle. Direction-neutral: it only measures boxes. */
function centreSelectedTab(list: HTMLElement): void {
  const tab = list.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!tab) return;
  const listBox = list.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  const shift = tabBox.left + tabBox.width / 2 - (listBox.left + listBox.width / 2);
  list.scrollBy({ left: shift, behavior: "auto" });
}

/**
 * Centres the selected tab now, again once the fonts have loaded (they change the tab widths), and
 * again whenever the list is resized. Returns the cleanup. Both late triggers are skipped where the
 * browser lacks `document.fonts` or `ResizeObserver`.
 */
export function keepSelectedTabCentred(list: HTMLElement): () => void {
  let active = true;
  centreSelectedTab(list);
  void document.fonts?.ready.then(() => {
    if (active) centreSelectedTab(list);
  });
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => centreSelectedTab(list));
  observer?.observe(list);
  return () => {
    active = false;
    observer?.disconnect();
  };
}
