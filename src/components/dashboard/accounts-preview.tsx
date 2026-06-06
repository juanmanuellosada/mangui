"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { CurrencyChip } from "@/components/ui/currency-chip"
import { createClient } from "@/lib/supabase/client"
import {
  renderAccountIcon,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountBalance,
} from "@/lib/accounts"
import { formatCurrency, cn } from "@/lib/utils"
import type { RateType, RatesMap } from "@/lib/rates/dolar"
import type { Tables } from "@/lib/database.types"
import { fetchAllMovements } from "@/lib/movements"
import { nextCardPayment } from "@/lib/cards"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

type CardStatement = Tables<"card_statements">

interface AccountsPreviewProps {
  rateType: RateType
  manualRate: number | null
  rates: RatesMap
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
  if (error) throw error
  return data
}

async function fetchAllStatements(): Promise<CardStatement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("card_statements")
    .select("*")
    .eq("status", "pendiente")
    .order("due_date", { ascending: true })
  if (error) throw error
  return data
}

function AccountCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3 flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="space-y-1.5 items-end flex flex-col">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-2.5 w-8" />
      </div>
    </div>
  )
}

function getConversionRate(
  rateType: RateType,
  rates: RatesMap,
  manualRate: number | null,
  fromCurrency: "ARS" | "USD"
): number {
  if (rateType === "manual") return manualRate ?? 1
  const data = rates[rateType as keyof RatesMap]
  if (!data) return 0
  return fromCurrency === "ARS" ? (data.sell || 0) : (data.buy || 0)
}

export function AccountsPreview({ rateType, manualRate, rates }: AccountsPreviewProps) {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  })

  const { data: balances, isLoading: loadingBalances } = useQuery({
    queryKey: ["account_balances"],
    queryFn: fetchBalances,
  })

  const { data: statements, isLoading: loadingStatements } = useQuery({
    queryKey: ["card_statements"],
    queryFn: fetchAllStatements,
  })

  const { data: allMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const isLoading = loadingAccounts || loadingBalances || loadingStatements || loadingMovements

  const balanceMap = new Map(
    (balances ?? []).map((b) => [b.account_id, b])
  )

  const visible = (accounts ?? []).filter((a) => !a.is_hidden)

  return (
    <section className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground">Cuentas</h2>
        <Link
          href="/cuentas"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Ver todas
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <AccountCardSkeleton />
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </>
        ) : (
          visible.map((account) => {
            const bal = balanceMap.get(account.id)
            const balance = bal?.current_balance ?? account.initial_balance
            const currency = account.currency ?? "ARS"
            const type = account.type
            const isCreditCard = type === "tarjeta_credito"

            // ── Credit card: compute next-due amount ──────────────────────────
            let cardAmountARS = 0
            let cardAmountUSD: number | null = null
            let cardDueDate: string | null = null

            if (isCreditCard) {
              const { amount, dueDate } = nextCardPayment(
                account.id,
                account,
                statements ?? [],
                allMovements ?? []
              )
              cardAmountARS = amount
              cardDueDate = dueDate

              // Convert ARS → USD
              if (currency === "ARS") {
                const rate = getConversionRate(rateType, rates, manualRate, "ARS")
                cardAmountUSD = rate > 0 ? cardAmountARS / rate : null
              } else {
                // Card is in USD — flip display: show USD as primary, ARS as secondary
                cardAmountUSD = cardAmountARS
                const rate = getConversionRate(rateType, rates, manualRate, "USD")
                cardAmountARS = rate > 0 ? cardAmountUSD * rate : 0
              }
            }

            return (
              <div
                key={account.id}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card px-3.5 py-3 flex items-center gap-3 hover:border-primary/20 hover:shadow-sm transition-all duration-150"
              >
                {/* Left color accent */}
                <span
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{ background: account.color ?? "#65a30d" }}
                />

                {/* Icon */}
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {renderAccountIcon(account.icon, {
                    size: "h-5 w-5",
                    className: "text-muted-foreground",
                    logoFill: true,
                  })}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{account.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {ACCOUNT_TYPE_LABELS[type]}
                    </span>
                    {type === "tarjeta_credito" &&
                      account.closing_day != null && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="whitespace-nowrap">
                            Cierre {account.closing_day}
                          </span>
                        </>
                      )}
                    {type === "tarjeta_credito" &&
                      account.due_day != null && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="whitespace-nowrap">
                            Vto {account.due_day}
                          </span>
                        </>
                      )}
                  </div>
                </div>

                {/* Balance / Amount due */}
                <div className="text-right flex-shrink-0">
                  {isCreditCard ? (
                    <>
                      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                        {cardDueDate
                          ? `Vence ${format(parseISO(cardDueDate), "d/M", { locale: es })}`
                          : "A pagar"}
                      </p>
                      <p className="text-sm font-bold tabular-nums text-destructive">
                        {currency === "ARS"
                          ? formatCurrency(-cardAmountARS, "ARS")
                          : formatCurrency(-(cardAmountUSD ?? 0), "USD")}
                      </p>
                      <p className="text-[11px] text-destructive/80 tabular-nums mt-0.5">
                        {currency === "ARS"
                          ? cardAmountUSD != null
                            ? formatCurrency(-cardAmountUSD, "USD")
                            : "—"
                          : formatCurrency(-cardAmountARS, "ARS")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          balance < 0 ? "text-destructive" : "text-foreground"
                        )}
                      >
                        {formatCurrency(balance, currency)}
                      </p>
                      <div className="flex justify-end mt-0.5">
                        <CurrencyChip currency={currency} size="sm" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
