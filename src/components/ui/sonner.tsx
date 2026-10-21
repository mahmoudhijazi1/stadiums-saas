"use client"

import { useEffect, useState, type CSSProperties } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function useMinLg(): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])
  return wide
}

const PHONE_BOTTOM = "calc(104px + env(safe-area-inset-bottom))"

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const wide = useMinLg()
  // Sonner positions are physical. Inline-end is right in LTR and left in RTL.
  const position = wide
    ? props.dir === "rtl"
      ? "bottom-left"
      : "bottom-right"
    : "bottom-center"

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
      position={position}
      // Sonner uses `mobileOffset` below 600px and `offset` above, so both clear the floating tab bar
      // (about 84px tall plus the safe area) with a gap, and neither covers it.
      offset={wide ? { bottom: "1rem" } : { bottom: PHONE_BOTTOM }}
      mobileOffset={{ bottom: PHONE_BOTTOM, left: "0.75rem", right: "0.75rem" }}
      // Swipe sideways to dismiss, in both directions (the default is only toward the bottom edge).
      swipeDirections={["left", "right"]}
      closeButton
      toastOptions={{
        closeButton: true,
        ...toastOptions,
      }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        close: <XIcon className="size-4" />,
      }}
    />
  )
}

export { Toaster }
