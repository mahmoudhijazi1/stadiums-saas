import type { Metadata } from "next";
import { PRIMARY_ACTION, StatusPage } from "@/components/shell/status-page";
import { ui } from "@/lib/copy";

export const metadata: Metadata = {
  title: "404",
  robots: { index: false, follow: false },
};

/**
 * Every 404 of the app (an unknown path, an unknown stadium, a host check). It resolves nothing: no
 * tenant, no session, no database. Arabic first, the English line under it, like the error pages.
 * One action: the home page of the same host ("/": the stadium's page, or the landing page).
 */
export default function NotFound() {
  return (
    <StatusPage
      mark={
        <p aria-hidden="true" dir="ltr" className="font-display text-7xl leading-none font-extrabold tracking-tight text-foreground sm:text-8xl">
          404
        </p>
      }
      titleAr={ui("notFound.title", "ar")}
      lineAr={ui("notFound.line", "ar")}
      titleEn={ui("notFound.title", "en")}
      lineEn={ui("notFound.line", "en")}
    >
      <a href="/" className={PRIMARY_ACTION}>
        {`${ui("notFound.home", "ar")} · ${ui("notFound.home", "en")}`}
      </a>
    </StatusPage>
  );
}
