"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { errorMessage } from "@/lib/copy/errors"
import type { UiLocale } from "@/lib/locale"
import { giveBackText } from "@/lib/copy/helpers"
import { successMessage } from "@/lib/copy/success"

/**
 * Toast from ?ok= / ?error= (and legacy public ?received=1), then strip
 * those keys. Must sit under <Suspense> (use-search-params.md).
 * Local Next use-router.md: router.replace.
 * A game collection that handed back change adds `changeUsd` / `changeLbp`: the toast then says
 * what to give back (DR-007).
 * Does not strip `highlight` (Home confirm-notify ring after Approve).
 */
function FlashToast({ locale = "ar" }: { locale?: UiLocale }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shown = React.useRef(false)

  React.useEffect(() => {
    const error = searchParams.get("error") ?? undefined
    const received = searchParams.get("received")
    const ok =
      searchParams.get("ok") ??
      (received === "1" ? "requested" : undefined)
    if (!ok && !error) {
      shown.current = false
      return
    }
    if (shown.current) return
    shown.current = true
    if (error) toast.error(errorMessage(error, locale))
    else if (ok) {
      const description = giveBackText(
        { usd: searchParams.get("changeUsd") ?? "0", lbp: searchParams.get("changeLbp") ?? "0" },
        locale,
        searchParams.get("kept") === "1",
      )
      toast.success(successMessage(ok, locale), description ? { description } : undefined)
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete("ok")
    next.delete("error")
    next.delete("received")
    next.delete("changeUsd")
    next.delete("changeLbp")
    next.delete("kept")
    next.delete("sheet")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, pathname, router, locale])

  return null
}

export { FlashToast }
