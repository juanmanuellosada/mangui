"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ArrowUpCircle, ArrowDownCircle, PlusCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryError } from "@/components/ui/query-error"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import type { Tables } from "@/lib/database.types"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { useQuickAdd } from "@/components/quick-add-provider"
import { MangoSelect } from "@/components/ui/mango-select"
import { lastN } from "@/lib/date-ranges"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"

type Movement = Tables<"movements">

const DAYS_OPTIONS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "15", label: "Últimos 15 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
]

async function fetchRecentMovements(days: string): Promise<Movement[]> {
  const supabase = createClient()
  const { from } = lastN(Number(days), "days")
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .gte("date", from!)
    .eq("is_future", false)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

function formatDateShort(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return "Hoy"
  if (isYesterday(d)) return "Ayer"
  return format(d, "d MMM", { locale: es })
}

export function RecentMovements() {
  const quickAdd = useQuickAdd()
  const [days, setDays] = useState("30")

  const {
    data: movements,
    isLoading: loadingMovements,
    isError: movementsError,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: ["movements", "recent", days],
    queryFn: () => fetchRecentMovements(days),
    staleTime: 60 * 1000,
  })

  const { data: accounts = [] } = useAccounts()

  const { data: categories = [] } = useCategories()

  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">Actividad reciente</h3>
        <div className="flex items-center gap-2">
          <MangoSelect
            value={days}
            onChange={setDays}
            options={DAYS_OPTIONS}
            triggerClassName="w-auto text-xs h-8 px-2"
            aria-label="Período de actividad"
          />
          {accounts.length > 0 && (
            <button
              type="button"
              onClick={() => quickAdd.open()}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5 cursor-pointer")}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Nuevo
            </button>
          )}
        </div>
      </div>

      {loadingMovements && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      )}

      {!loadingMovements && movementsError && (
        <QueryError onRetry={() => refetchMovements()} />
      )}

      {!loadingMovements && !movementsError && (!movements || movements.length === 0) && (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Sin actividad en los últimos {days} días.
          </p>
        </div>
      )}

      {!loadingMovements && movements && movements.length > 0 && (
        <div className="max-h-[22rem] overflow-y-auto divide-y divide-border/40">
          {movements.map((m) => {
            const isIncome = m.type === "income"
            const account = accountMap.get(m.account_id)
            const category = m.category_id ? categoryMap.get(m.category_id) : undefined
            const displayAmount = m.converted_amount ?? m.amount
            const displayCurrency = account?.currency ?? m.original_currency

            return (
              <div
                key={m.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                {/* Icon */}
                <div
                  className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    isIncome ? "bg-success/10" : "bg-destructive/10"
                  )}
                >
                  {isIncome ? (
                    <ArrowUpCircle className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {category?.name ?? "Sin categoría"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {account?.name ?? "—"} · {formatDateShort(m.date)}
                  </p>
                </div>

                {/* Amount */}
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums flex-shrink-0",
                    isIncome ? "text-success" : "text-destructive"
                  )}
                >
                  {isIncome ? "+" : "−"}
                  {formatCurrency(displayAmount, displayCurrency)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/movimientos"
        className="flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver todos
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
