/**
 * The colour of the phone's system bars (Android status bar, iOS Safari bars) is the page background
 * of the theme the owner is actually looking at. One source for both values: they are the --bg role
 * of the light and dark themes (--ls-paper-100 and --ls-carbon-900 in globals.css; a test keeps them
 * equal). The browser picks the colour of the bar's icons and clock from this colour, so a bar that
 * matches the page never hides them.
 */
export const THEME_COLOR = { light: "#F6F5EF", dark: "#111412" } as const;

export type ResolvedTheme = keyof typeof THEME_COLOR;

/** The meta `theme-color` nodes of a document, as much of the DOM as this module needs. */
export type ThemeColorRoot = {
  querySelectorAll(selector: string): ArrayLike<{ setAttribute(name: string, value: string): void }>;
};

/**
 * Point every `<meta name="theme-color">` at the colour of `theme`. The server renders one tag per
 * OS preference (right until the owner picks a theme that differs from the phone's); this makes all
 * of them say the same thing, so the OS preference no longer decides.
 */
export function applyThemeColor(root: ThemeColorRoot, theme: ResolvedTheme): void {
  const tags = root.querySelectorAll('meta[name="theme-color"]');
  for (let i = 0; i < tags.length; i += 1) tags[i]?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * A tiny script for the start of <body>: it does what next-themes does (the stored `theme`, else the
 * OS preference) and sets the bar colour before the first paint, so a forced theme never flashes the
 * wrong bar. It must not throw (storage can be blocked).
 */
export function themeColorScript(): string {
  return `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((t===null||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);var c=d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c)}catch(e){}})()`;
}
