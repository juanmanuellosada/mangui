"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, TrendingUp } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
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
    .filter((b) => b.currency === "ARS")
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  const totalUSD = visible
    .filter((b) => b.currency === "USD")
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  const arsRate = getConversionRate(rateType, rates, manualRate, "ARS")
  const usdRate = getConversionRate(rateType, rates, manualRate, "USD")

  const grandTotal =
    displayCurrency === "ARS"
      ? totalARS + totalUSD * usdRate
      : totalUSD + totalARS / arsRate

  const otherCurrency = displayCurrency === "ARS" ? "USD" : "ARS"

  return (
    <div className="space-y-3">
      {/* Hero total card */}
      <div className="rounded-2xl bg-primary p-5 shadow-lg shadow-primary/25 relative overflow-hidden">
        {/* Decorative blob */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary-foreground/5 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-primary-foreground/5 blur-xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary-foreground/70" />
              <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wider">
                Balance total
              </p>
            </div>
            <button
              onClick={() => setDisplayCurrency(otherCurrency)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground",
                "px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer press-effect",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
              )}
              title={`Ver en ${otherCurrency}`}
            >
              <ArrowLeftRight className="h-3 w-3" />
              {otherCurrency}
            </button>
          </div>

          {isLoading ? (
            <Skeleton className="h-10 w-48 bg-primary-foreground/20" />
          ) : (
            <p
              className="text-4xl md:text-5xl font-bold tabular-nums text-primary-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatCurrency(grandTotal, displayCurrency)}
            </p>
          )}

          <p className="text-xs text-primary-foreground/50 mt-2 font-medium">
            {displayCurrency === "ARS" ? "Pesos argentinos" : "Dólares estadounidenses"}
          </p>
        </div>
      </div>

      {/* Per-currency subtotals */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn(
            "rounded-xl border p-4 transition-all duration-150",
            displayCurrency === "ARS"
              ? "border-primary/20 bg-primary/5"
              : "border-border/60 bg-card"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            ARS
          </p>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(totalARS, "ARS")}
            </p>
          )}
        </div>

        <div
          className={cn(
            "rounded-xl border p-4 transition-all duration-150",
            displayCurrency === "USD"
              ? "border-accent/20 bg-accent/5"
              : "border-border/60 bg-card"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            USD
          </p>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <p className={cn("text-lg font-bold tabular-nums", totalUSD > 0 && "text-accent")}>
              {formatCurrency(totalUSD, "USD")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
