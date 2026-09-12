"use client"

import type { ComponentProps } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

/**
 * Next forms.md: useFormStatus must live in a child of <form>, not the form itself.
 * Disable + "…" while the Server Action runs.
 */
function SubmitButton({
  children,
  pendingLabel = "…",
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()

  return (
    <Button {...props} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

export { SubmitButton }
