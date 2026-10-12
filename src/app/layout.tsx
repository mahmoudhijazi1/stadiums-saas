import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import { accentCss } from "@/modules/stadium/domain/accent-css";
import { brandIconPath } from "@/modules/stadium/domain/brand-identity";
import { OwnerServiceWorker } from "@/components/shell/owner-service-worker";
import { ScrollbarPeek } from "@/components/ui/scrollbar-peek";
import { SystemBars } from "@/components/shell/system-bars";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getUiLocale } from "@/lib/get-ui-locale";
import { htmlDir, htmlLang, LANDING_HEADER, parseLandingLocale } from "@/lib/locale";
import { LEBSTADS_ICONS } from "@/lib/lebstads-brand";
import { isBareHostFromHeaders } from "@/lib/tenant-slug";
import { ui } from "@/lib/copy";
import { THEME_COLOR, themeColorScript } from "@/lib/theme-color";
import "./globals.css";

// Self-hosted (no request to Google at build or run time): local font.md, `next/font/local`.
// Files live in src/fonts with their OFL licences. Only the weights the UI uses are shipped.
// IBM Plex Sans Arabic ships as two files per weight (Arabic and Latin subsets). They are
// two loaders because next/font/local has no per-face unicode-range; the stack lists both
// and the browser falls through per glyph.
const plexArabic = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-arabic/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
});

const plexArabicLatin = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-arabic/ibm-plex-sans-arabic-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic/ibm-plex-sans-arabic-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-arabic-latin",
  display: "swap",
});

const manrope = localFont({
  src: [
    { path: "../fonts/manrope/manrope-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/manrope/manrope-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

// Big Shoulders: only the weight the UI uses (800, the one big figure).
const display = localFont({
  src: [
    { path: "../fonts/big-shoulders/big-shoulders-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-big-shoulders",
  display: "swap",
  fallback: ["IBM Plex Sans Arabic", "sans-serif"],
});

const plexMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getUiLocale();
  // Per request: this host's generated logo (neutral lebstads when the host names no active stadium).
  const identity = await currentBrandIdentity();
  // The bare host is the landing page and the platform admin, not an installable owner app: no manifest link.
  const bare = isBareHostFromHeaders(await headers());
  return {
    title: ui("doc.title", locale),
    description: "Book a pitch. Collect in cash.",
    ...(bare ? { manifest: null } : {}),
    // The bare host has its own LebStads files; a stadium's host keeps its generated letter logo.
    icons: {
      icon: [{ url: bare ? LEBSTADS_ICONS["32"] : brandIconPath("32", identity), sizes: "32x32", type: "image/png" }],
      apple: [{ url: bare ? LEBSTADS_ICONS["180"] : brandIconPath("180", identity), sizes: "180x180", type: "image/png" }],
    },
  };
}

// Local generate-viewport.md: media-keyed themeColor; colorScheme light dark.
// Values match --bg light (--ls-paper-100) and --bg dark (--ls-carbon-900) (src/lib/theme-color.ts).
// These tags follow the OS preference; the script and SystemBars below make them follow the app theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getUiLocale();
  // The landing routes of the bare host carry their language in a header the proxy sets; anywhere
  // else (and for any other value) the page language is the cookie's, as before.
  const requestHeaders = await headers();
  const landingLocale = isBareHostFromHeaders(requestHeaders) ? parseLandingLocale(requestHeaders.get(LANDING_HEADER)) : null;
  const pageLocale = landingLocale ?? locale;
  // This host's stadium accent, server-rendered in <head> so the first paint already has it (no
  // flash of the default). Only constants from BRAND_PRESETS reach the CSS; an unknown key, a
  // missing or suspended stadium gives the default.
  const identity = await currentBrandIdentity();
  return (
    <html
      lang={htmlLang(pageLocale)}
      dir={htmlDir(pageLocale)}
      suppressHydrationWarning
      className={`${manrope.variable} ${plexArabic.variable} ${plexArabicLatin.variable} ${display.variable} ${plexMono.variable} h-full bg-background antialiased`}
    >
      <head>
        <style id="accent" dangerouslySetInnerHTML={{ __html: accentCss(identity?.preset) }} />
      </head>
      <body className="min-h-svh flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeColorScript() }} />
        <ThemeProvider>
          <SystemBars />
          <OwnerServiceWorker />
          <ScrollbarPeek />
          {children}
          <Toaster
            dir={htmlDir(locale)}
            toastOptions={{ closeButtonAriaLabel: ui("dialog.close", locale) }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
