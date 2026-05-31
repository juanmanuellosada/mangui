"use client"

/**
 * CurrencyChip — compact currency indicator with coin logo on the left.
 * Renders the coin SVG from the AR monedas catalog + the ISO code.
 */

import { cn } from "@/lib/utils"

type SupportedCurrency = "ARS" | "USD"

const COIN_ICONS: Record<SupportedCurrency, string> = {
  ARS: "/icons/ar/monedas/ARS.svg",
  USD: "/icons/ar/monedas/USD.svg",
}

interface CurrencyChipProps {
  currency: string
  size?: "sm" | "md"
  className?: string
}

export function CurrencyChip({ currency, size = "sm", className }: CurrencyChipProps) {
  const iconSrc = COIN_ICONS[currency as SupportedCurrency]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold uppercase tracking-wider",
        size === "sm" && "text-[10px]",
        size === "md" && "text-xs",
        "text-muted-foreground",
        className
      )}
    >
      {iconSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconSrc}
          alt=""
          aria-hidden
          className={cn(
            "object-contain rounded-[3px] shrink-0",
            size === "sm" && "h-[14px] w-[14px]",
            size === "md" && "h-[16px] w-[16px]",
          )}
          loading="eager"
        />
      )}
      <span>{currency}</span>
    </span>
  )
}

/** Standalone coin logo img for use inside MangoSelect option leading slots */
export function CurrencyLogo({ currency, className }: { currency: SupportedCurrency; className?: string }) {
  const src = COIN_ICONS[currency]
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={currency}
      className={cn("h-[15px] w-[15px] object-contain rounded-[3px] shrink-0", className)}
      loading="eager"
    />
  )
}
