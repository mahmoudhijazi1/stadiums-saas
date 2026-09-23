import type { Metadata, Viewport } from "next";
import {
  Big_Shoulders,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Noto_Kufi_Arabic,
} from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getUiLocale } from "@/lib/get-ui-locale";
import { htmlDir, htmlLang } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import "./globals.css";

// Local next/dist/docs/01-app/03-api-reference/02-components/font.md:
// CSS variable method; non-variable fonts require weight; subsets for preload.
// Google packages the display face as Big_Shoulders (not Big_Shoulders_Display).
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-kufi",
  display: "swap",
});

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-big-shoulders",
  display: "swap",
  fallback: ["Noto Kufi Arabic", "IBM Plex Sans Arabic", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getUiLocale();
  return (
    <html
      lang={htmlLang(locale)}
      dir={htmlDir(locale)}
      suppressHydrationWarning
      className={`${plexArabic.variable} ${kufi.variable} ${display.variable} ${plexMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-svh flex flex-col">
        <ThemeProvider>
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
