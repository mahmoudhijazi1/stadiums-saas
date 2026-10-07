import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { OwnerServiceWorker } from "@/components/owner-service-worker";
import { ScrollbarPeek } from "@/components/scrollbar-peek";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getUiLocale } from "@/lib/get-ui-locale";
import { htmlDir, htmlLang } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
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
  return {
    title: ui("doc.title", locale),
    description: "Book a pitch. Collect in cash.",
  };
}

// Local generate-viewport.md: media-keyed themeColor; colorScheme light dark.
// Values match --bg light (--ls-paper-100) and --bg dark (--ls-carbon-900).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5EF" },
    { media: "(prefers-color-scheme: dark)", color: "#111412" },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getUiLocale();
  return (
    <html
      lang={htmlLang(locale)}
      dir={htmlDir(locale)}
      suppressHydrationWarning
      className={`${manrope.variable} ${plexArabic.variable} ${plexArabicLatin.variable} ${display.variable} ${plexMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-svh flex flex-col">
        <ThemeProvider>
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
