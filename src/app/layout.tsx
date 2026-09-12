import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Noto_Kufi_Arabic,
} from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getUiLocale } from "@/lib/get-ui-locale";
import { htmlDir, htmlLang } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import "./globals.css";

// Local next/dist/docs/01-app/03-api-reference/02-components/font.md:
// CSS variable method; non-variable fonts require weight; subsets for preload.
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getUiLocale();
  return (
    <html
      lang={htmlLang(locale)}
      dir={htmlDir(locale)}
      className={`${plexArabic.variable} ${kufi.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-svh flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
