"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { CurrencyChip } from "@/components/ui/currency-chip"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { AccountBalance } from "@/lib/accounts"
import type { RateType, RatesMap } from "@/lib/rates/dolar"

interface BalanceCardsProps {
  defaultCurrency: "ARS" | "USD"
  rateType: RateType
  manualRate: number | null
  /** Pre-fetched rates from the server (avoids client fetching DolarAPI) */
  rates: RatesMap
}

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
  if (error) throw error
  return data
}

function getConversionRate(
  rateType: RateType,
  rates: RatesMap,
  manualRate: number | null,
  fromCurrency: "ARS" | "USD"
): number {
  if (rateType === "manual") return manualRate ?? 1
  const data = rates[rateType as keyof RatesMap]
  if (!data) return 1
  return fromCurrency === "ARS" ? (data.sell || 1) : (data.buy || 1)
}

export function BalanceCards({
  defaultCurrency,
  rateType,
  manualRate,
  rates,
}: BalanceCardsProps) {
  const [displayCurrency, setDisplayCurrency] = useState<"ARS" | "USD">(
    defaultCurrency
  )

  const { data: balances, isLoading } = useQuery({
    queryKey: ["account_balances"],
    queryFn: fetchBalances,
  })

  const visible = balances?.filter((b) => !b.is_hidden) ?? []

  const totalARS = visible
    .filter((b) => b.currency === "ARS" && b.account_type !== "tarjeta_credito")
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  const totalUSD = visible
    .filter((b) => b.currency === "USD" && b.account_type !== "tarjeta_credito")
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  const arsRate = getConversionRate(rateType, rates, manualRate, "ARS")
  const usdRate = getConversionRate(rateType, rates, manualRate, "USD")

  const grandTotal =
    displayCurrency === "ARS"
      ? totalARS + totalUSD * usdRate
      : totalUSD + totalARS / arsRate

  return (
    <div
      className={cn(
        "rounded-2xl p-4 sm:p-5 relative overflow-hidden",
        "bg-primary shadow-lg",
        "shadow-primary/30"
      )}
    >
      {/* Soft decorative blobs — GPU only (opacity) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-primary-foreground/5"
        style={{ filter: "blur(24px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-primary-foreground/5"
        style={{ filter: "blur(20px)" }}
      />

      <div className="relative z-10 space-y-4 min-w-0">
        {/* Label row */}
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/60">
          Balance total
        </p>

        {/* Big hero number */}
        {isLoading ? (
          <Skeleton className="h-12 w-56 bg-primary-foreground/20" />
        ) : (
          <p
            className="text-3xl sm:text-4xl md:text-5xl font-bold tabular-nums text-primary-foreground leading-none truncate min-w-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {formatCurrency(grandTotal, displayCurrency)}
          </p>
        )}

        {/* Sub-totals in the other currency */}
        <div className="flex items-center gap-3 pt-1">
          {/* ARS pill */}
          <button
            type="button"
            onClick={() => setDisplayCurrency("ARS")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 rounded-lg font-semibold tabular-nums transition-colors duration-150 press-effect cursor-pointer",
              "min-h-[44px] sm:min-h-0 sm:px-2.5 sm:py-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50",
              displayCurrency === "ARS"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary-foreground/8 text-primary-foreground/60 hover:bg-primary-foreground/15"
            )}
          >
            {isLoading ? (
              <Skeleton className="h-3 w-20 bg-primary-foreground/20" />
            ) : (
              <>
                <CurrencyChip currency="ARS" className="opacity-70 text-primary-foreground" />
                {formatCurrency(totalARS, "ARS")}
              </>
            )}
          </button>
          {/* USD pill */}
          <button
            type="button"
            onClick={() => setDisplayCurrency("USD")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 rounded-lg font-semibold tabular-nums transition-colors duration-150 press-effect cursor-pointer",
              "min-h-[44px] sm:min-h-0 sm:px-2.5 sm:py-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50",
              displayCurrency === "USD"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary-foreground/8 text-primary-foreground/60 hover:bg-primary-foreground/15"
            )}
          >
            {isLoading ? (
              <Skeleton className="h-3 w-16 bg-primary-foreground/20" />
            ) : (
              <>
                <CurrencyChip currency="USD" className="opacity-70 text-primary-foreground" />
                {formatCurrency(totalUSD, "USD")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
