"use client"

/**
 * CurrencySelect — bespoke currency picker for mangui.
 * Built on MangoSelect. Options: ARS (🇦🇷 + "$") and USD (🇺🇸 + "US$").
 * Default: ARS.
 */

import { MangoSelect, type MangoSelectProps } from "./mango-select"
import { cn } from "@/lib/utils"

export type CurrencyValue = "ARS" | "USD"

const CURRENCY_OPTIONS = [
  {
    value: "ARS" as const,
    label: "ARS",
    leading: (
      <span className="text-base leading-none select-none" aria-hidden>
        🇦🇷
      </span>
    ),
  },
  {
    value: "USD" as const,
    label: "US$",
    leading: (
      <span className="text-base leading-none select-none" aria-hidden>
        🇺🇸
      </span>
    ),
  },
]

type CurrencySelectProps = Omit<MangoSelectProps, "options"> & {
  value: CurrencyValue
  onChange: (value: CurrencyValue) => void
}

export function CurrencySelect({
  value = "ARS",
  onChange,
  className,
  ...rest
}: CurrencySelectProps) {
  return (
    <MangoSelect
      options={CURRENCY_OPTIONS}
      value={value}
      onChange={(v) => onChange(v as CurrencyValue)}
      className={cn("w-28", className)}
      aria-label="Moneda"
      {...rest}
    />
  )
}
