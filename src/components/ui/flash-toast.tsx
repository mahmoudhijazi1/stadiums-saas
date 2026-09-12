"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { errorMessage } from "@/lib/error-messages"
import type { UiLocale } from "@/lib/locale"
import { successMessage } from "@/lib/success-messages"

/**
 * Toast from ?ok= / ?error= (and legacy public ?received=1), then strip
 * those keys. Must sit under <Suspense> (use-search-params.md).
 * Local Next use-router.md: router.replace.
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
    else if (ok) toast.success(successMessage(ok, locale))
    const next = new URLSearchParams(searchParams.toString())
    next.delete("ok")
    next.delete("error")
    next.delete("received")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, pathname, router, locale])

  return null
}

export { FlashToast }
