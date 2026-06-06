"use client"

import { useQuery } from "@tanstack/react-query"
import { parseISO, differenceInCalendarDays } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { SummaryTotals } from "@/lib/stats"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">
type Account = Tables<"accounts">

type ProjectedBalance = {
  account_id: string | null
  currency: "ARS" | "USD" | null
  projected_balance: number | null
  is_hidden: boolean | null
  account_type: string | null
}

interface HealthKpisProps {
  totals: SummaryTotals
  movements: Movement[]
  accounts: Account[]
  currency: "ARS" | "USD"
  dateFrom: string | null
  dateTo: string | null
}

async function fetchProjectedBalances(): Promise<ProjectedBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_balances_projected")
    .select("account_id, currency, projected_balance, is_hidden, account_type")
  if (error) throw error
  return (data ?? []) as ProjectedBalance[]
}

function periodDays(
  movements: Movement[],
  dateFrom: string | null,
  dateTo: string | null
): number {
  const today = new Date()

  let from: Date
  let to: Date

  if (dateFrom) {
    from = parseISO(dateFrom)
  } else if (movements.length > 0) {
    from = parseISO(movements.map((m) => m.date).sort()[0] + "T12:00:00")
  } else {
    from = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  if (dateTo) {
    to = parseISO(dateTo) < today ? parseISO(dateTo) : today
  } else if (movements.length > 0) {
    to = today
  } else {
    to = today
  }

  return Math.max(1, differenceInCalendarDays(to, from) + 1)
}

export function HealthKpis({
  totals,
  movements,
  accounts,
  currency,
  dateFrom,
  dateTo,
}: HealthKpisProps) {
  const { data: projectedBalances, isLoading: loadingProjected } = useQuery({
    queryKey: ["account_balances_projected"],
    queryFn: fetchProjectedBalances,
  })

  // KPI 1: savings rate
  const savingsRate = totals.income > 0 ? (totals.net / totals.income) * 100 : null

  // KPI 2: daily expense pace
  const days = periodDays(movements, dateFrom, dateTo)
  const dailyExpense = totals.expense / days

  // KPI 3: projected end-of-month balance (global, per currency)
  const accMap = new Map(accounts.map((a) => [a.id, a]))
  let projARS = 0
  let projUSD = 0

  if (projectedBalances) {
    for (const row of projectedBalances) {
      if (row.is_hidden) continue
      if (!row.account_id) continue
      const acc = accMap.get(row.account_id)
      if (acc?.type === "tarjeta_credito") continue
      const bal = row.projected_balance ?? 0
      if (row.currency === "ARS") projARS += bal
      else if (row.currency === "USD") projUSD += bal
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold">Salud financiera</h3>
      <div className="grid grid-cols-3 gap-3">
        {/* Savings rate */}
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Tasa de ahorro
          </p>
          <p
            className={`text-lg font-bold tabular-nums leading-tight ${
              savingsRate === null
                ? "text-muted-foreground"
                : savingsRate >= 0
                ? "text-success"
                : "text-destructive"
            }`}
          >
            {savingsRate === null ? "—" : `${savingsRate.toFixed(1)}%`}
          </p>
          <p className="text-[10px] text-muted-foreground">del ingreso</p>
        </div>

        {/* Daily expense */}
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Ritmo diario
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight text-foreground">
            {formatCurrency(dailyExpense, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground">por día</p>
        </div>

        {/* Projected EOM balance */}
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Fin de mes
          </p>
          {loadingProjected ? (
            <Skeleton className="h-5 w-20 mt-1" />
          ) : (
            <>
              <p className="text-lg font-bold tabular-nums leading-tight text-foreground">
                {formatCurrency(projARS, "ARS")}
              </p>
              {projUSD !== 0 && (
                <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  +{formatCurrency(projUSD, "USD")}
                </p>
              )}
            </>
          )}
          <p className="text-[10px] text-muted-foreground">incl. futuros (global)</p>
        </div>
      </div>
    </div>
  )
}
