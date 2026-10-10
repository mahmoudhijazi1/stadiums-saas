/**
 * Category chips for the expense sheet, most recently used first. `recent` is what this member
 * (on this device) picked last, newest first; it may hold junk or repeats (it comes from browser
 * storage), so only known categories count, once each. The rest keep their usual order after
 * them. Pure: nothing is recorded or stored on the server for this.
 */
export function orderCategories<T extends string>(all: readonly T[], recent: readonly unknown[]): T[] {
  const known = new Set<string>(all);
  const first: T[] = [];
  for (const item of recent) {
    if (typeof item === "string" && known.has(item) && !first.includes(item as T)) first.push(item as T);
  }
  return [...first, ...all.filter((category) => !first.includes(category))];
}

/** The new "recent" list after picking `category`: it goes first, the list stays short. */
export function rememberCategory(recent: readonly unknown[], category: string, keep = 8): string[] {
  const rest = recent.filter((item): item is string => typeof item === "string" && item !== category);
  return [category, ...rest].slice(0, keep);
}
