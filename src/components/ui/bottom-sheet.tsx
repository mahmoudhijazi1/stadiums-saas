"use client"

import * as React from "react"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog"

const SHEET_EASE = "320ms cubic-bezier(0.32, 0.72, 0, 1)"

function BottomSheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <Dialog data-slot="bottom-sheet" {...props} />
}

function BottomSheetContent({
  className,
  children,
  closeLabel,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay className="duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none" />
      <DialogPrimitive.Content
        data-slot="bottom-sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col overflow-hidden",
          "max-h-[min(92dvh,100%)] rounded-t-2xl border bg-card text-card-foreground outline-none",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          "lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:max-h-[min(85dvh,100%)] lg:max-w-md lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[var(--radius-sheet)] lg:pb-6",
          "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 max-lg:data-[state=open]:slide-in-from-bottom lg:data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 max-lg:data-[state=closed]:slide-out-to-bottom lg:data-[state=closed]:zoom-out-95",
          "motion-reduce:animate-none motion-reduce:transition-none",
          className
        )}
        {...props}
      >
        <div
          aria-hidden
          className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 lg:hidden"
        />
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="bottom-sheet-close"
            className="absolute top-3 inset-e-3 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">{closeLabel ?? "إغلاق"}</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn("flex shrink-0 flex-col gap-1 px-4 pt-1 pe-12 text-start", className)}
      {...props}
    />
  )
}

function BottomSheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4",
        className
      )}
      {...props}
    />
  )
}

function BottomSheetStage({
  stage,
  active = true,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { stage: string; active?: boolean }) {
  const frameRef = React.useRef<HTMLDivElement>(null)
  const heightRef = React.useRef<number | null>(null)
  const skipRef = React.useRef(true)

  React.useLayoutEffect(() => {
    if (!active) {
      skipRef.current = true
      return
    }

    const frame = frameRef.current
    if (!frame) return

    const next = frame.offsetHeight
    const prev = heightRef.current
    heightRef.current = next

    if (skipRef.current) {
      skipRef.current = false
      frame.style.height = ""
      frame.style.transition = ""
      return
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    if (reduceMotion || prev == null || prev === next) return

    frame.style.transition = "none"
    frame.style.height = `${prev}px`
    void frame.offsetHeight
    frame.style.transition = `height ${SHEET_EASE}`
    frame.style.height = `${next}px`

    const clear = (event: TransitionEvent) => {
      if (event.target !== frame || event.propertyName !== "height") return
      frame.style.height = ""
      frame.style.transition = ""
      heightRef.current = frame.offsetHeight
      frame.removeEventListener("transitionend", clear)
    }
    frame.addEventListener("transitionend", clear)
    return () => {
      frame.removeEventListener("transitionend", clear)
      heightRef.current = frame.offsetHeight
    }
  }, [stage, active])

  return (
    <div
      ref={frameRef}
      data-slot="bottom-sheet-stage"
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function BottomSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function BottomSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="bottom-sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetStage,
  BottomSheetTitle,
}
