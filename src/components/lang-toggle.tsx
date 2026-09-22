"use client";

import { useRouter } from "next/navigation";
import { setUiLocale } from "@/app/locale-actions";
import { Button } from "@/components/ui/button";
import {
  htmlDir,
  htmlLang,
  otherUiLocale,
  type UiLocale,
} from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * Header control. Sets cookie + html lang/dir (ar=rtl, en=ltr).
 */
export function LangToggle({
  locale,
  variant = "outline",
  size = "sm",
  className,
}: {
  locale: UiLocale;
  variant?: "outline" | "ghost";
  size?: "sm" | "icon-sm";
  className?: string;
}) {
  const router = useRouter();
  const next = otherUiLocale(locale);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-label={ui(
        next === "en" ? "public.langEnglish" : "public.langArabic",
        locale,
      )}
      onClick={async () => {
        document.documentElement.lang = htmlLang(next);
        document.documentElement.dir = htmlDir(next);
        await setUiLocale(next);
        router.refresh();
      }}
    >
      {ui(next === "en" ? "public.langToEn" : "public.langToAr", locale)}
    </Button>
  );
}
