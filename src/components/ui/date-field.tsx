"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { enGB } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { LtrIsolate } from "@/components/ui/ltr-isolate"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function parseYyyyMmDd(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }
  return date
}

function formatYyyyMmDd(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function DateField({
  name,
  id,
  defaultValue,
  required,
}: {
  name: string
  id?: string
  defaultValue?: string
  required?: boolean
}) {
  const [value, setValue] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const selected = parseYyyyMmDd(value)

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-11 w-full justify-between px-3 font-mono font-normal"
            aria-required={required}
          >
            <span>
              {value ? <LtrIsolate>{value}</LtrIsolate> : "Pick a date"}
            </span>
            <CalendarIcon className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              setValue(formatYyyyMmDd(date))
              setOpen(false)
            }}
            locale={enGB}
            numerals="latn"
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

export { DateField }
