"use client"

import { getDefaultClassNames, type Matcher } from "react-day-picker"
import { ar, enGB } from "react-day-picker/locale"

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { Calendar } from "@/components/ui/calendar"
import { ui } from "@/lib/copy"
import { formatDisplayDate } from "@/lib/format/time"
import type { UiLocale } from "@/lib/locale"
import { cn } from "cn"

/**
 * The one date picker surface. A bottom sheet on a phone (a big calendar the thumb can hit, easy to
 * dismiss) and a centred dialog on a desktop: the sheet already switches at the large breakpoint, so
 * one component fits both and nothing floats off the edge of a small screen the way a popover did.
 * The caller owns the trigger and the open state; picking a day calls `onSelect` and closes.
 * Single date only. Digits stay Western; the grid follows the language (Arabic runs right to left).
 */
export function CalendarSheet({
  open,
  onOpenChange,
  title,
  selected,
  defaultMonth,
  disabled,
  onSelect,
  locale = "en",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  selected?: Date
  defaultMonth?: Date
  disabled?: Matcher | Matcher[]
  onSelect: (date: Date) => void
  locale?: UiLocale
}) {
  const defaults = getDefaultClassNames()
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        <BottomSheetHeader>
          <BottomSheetTitle>{title}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="flex justify-center pb-4">
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected ?? defaultMonth}
            disabled={disabled}
            onSelect={(date) => {
              onSelect(date)
              onOpenChange(false)
            }}
            locale={locale === "ar" ? ar : enGB}
            dir={locale === "ar" ? "rtl" : "ltr"}
            numerals="latn"
            className="w-full max-w-sm bg-transparent [--cell-size:--spacing(11)]"
            classNames={{ root: cn("w-full", defaults.root) }}
            formatters={{
              formatCaption: (month) =>
                formatDisplayDate(
                  new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1, 12)),
                  locale,
                  { month: "long", year: "numeric" },
                  "UTC",
                ),
            }}
          />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  )
}
