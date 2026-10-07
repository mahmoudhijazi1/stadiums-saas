"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function SelectField({
  name,
  id,
  defaultValue,
  options,
  required,
  onValueChange,
}: {
  name: string
  id?: string
  defaultValue?: string
  required?: boolean
  options: { value: string; label: string }[]
  onValueChange?: (value: string) => void
}) {
  const [value, setValue] = React.useState(defaultValue ?? "")

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <Select
        value={value}
        onValueChange={(next) => {
          setValue(next)
          onValueChange?.(next)
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

export { SelectField }
