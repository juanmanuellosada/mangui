"use client"

/**
 * CurrencyToggle — segmented two-button currency selector.
 * Shows ARS and USD side by side with coin icons from the AR catalog.
 * Reusable in any form that needs a currency picker.
 */

import { cn } from "@/lib/utils"

export type CurrencyValue = "ARS" | "USD"

const COIN_ICONS: Record<CurrencyValue, string> = {
  ARS: "/icons/ar/monedas/ARS.svg",
  USD: "/icons/ar/monedas/USD.svg",
}

interface CurrencyToggleProps {
  value: CurrencyValue
  onChange: (value: CurrencyValue) => void
  className?: string
  id?: string
}

export function CurrencyToggle({ value, onChange, className, id }: CurrencyToggleProps) {
  return (
    <div
      id={id}
      role="group"
      aria-label="Moneda"
      className={cn(
        "flex gap-2",
        className
      )}
    >
      {(["ARS", "USD"] as const).map((currency) => {
        const isActive = value === currency
        return (
          <button
            key={currency}
            type="button"
            onClick={() => onChange(currency)}
            aria-pressed={isActive}
            className={cn(
              // Base — uniform pill shape, 44px min height for tap target
              "flex flex-1 items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-semibold",
              "transition-all duration-150 cursor-pointer select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // Active state — ARS gets lime brand tint, USD gets a green-teal tint
              isActive && currency === "ARS" && [
                "bg-lime-500/15 border-lime-500/50 text-lime-700 dark:text-lime-400",
              ],
              isActive && currency === "USD" && [
                "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-400",
              ],
              // Inactive state
              !isActive && "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/70 hover:border-border",
            )}
          >
            {/* Coin icon — transparent bg SVGs, no white wrapper */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={COIN_ICONS[currency]}
              alt={currency}
              className="h-[18px] w-[18px] object-contain rounded-[3px] shrink-0"
              loading="eager"
            />
            <span className="tabular-nums">{currency}</span>
          </button>
        )
      })}
    </div>
  )
}
