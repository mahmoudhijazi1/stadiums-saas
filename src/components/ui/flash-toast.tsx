"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { errorMessage } from "@/lib/error-messages"
import { successMessage } from "@/lib/success-messages"

/**
 * RSC passes ok/error from the URL. Toast once, then strip those keys
 * (keep tenant/date/period). Local Next use-router.md: router.replace.
 */
function FlashToast({
  ok,
  error,
  keepQuery,
}: {
  ok?: string
  error?: string
  keepQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const shown = React.useRef(false)

  React.useEffect(() => {
    if (shown.current) return
    if (!ok && !error) return
    shown.current = true
    if (error) toast.error(errorMessage(error))
    else if (ok) toast.success(successMessage(ok))
    const href = keepQuery ? `${pathname}?${keepQuery}` : pathname
    router.replace(href, { scroll: false })
  }, [ok, error, keepQuery, pathname, router])

  return null
}

export { FlashToast }
