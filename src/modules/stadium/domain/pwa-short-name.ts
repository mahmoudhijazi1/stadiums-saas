const SHORT_NAME_MAX = 12;

/** Code points, so Arabic letters count as one character each. */
function lengthOf(value: string): number {
  return [...value].length;
}

/**
 * Home-screen label. Keep whole words up to 12 characters.
 * A first word longer than 12 stays the full name so the OS can truncate it.
 */
export function pwaShortName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "lebstads";
  if (lengthOf(trimmed) <= SHORT_NAME_MAX) return trimmed;

  const words = trimmed.split(" ");
  const first = words[0] ?? trimmed;
  if (lengthOf(first) > SHORT_NAME_MAX) return trimmed;

  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (lengthOf(next) > SHORT_NAME_MAX) break;
    result = next;
  }
  return result;
}
