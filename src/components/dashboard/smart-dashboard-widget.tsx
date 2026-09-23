"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarClock, ChevronRight, Radar, TrendingUp } from "lucide-react"
import { QueryError } from "@/components/ui/query-error"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories } from "@/lib/hooks/use-categories"
import { fetchAllMovements } from "@/lib/movements"
import { todayAR } from "@/lib/date-utils"
import { buildSmartDashboardSignals } from "@/lib/dashboard/smart-dashboard"
import { formatCurrency } from "@/lib/utils"

function SmartDashboardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}

export function SmartDashboardWidget() {
  const {
    data: movements = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })
  const { data: categories = [] } = useCategories({ orderBy: "none" })
  const today = todayAR()

  const signals = useMemo(
    () => buildSmartDashboardSignals(movements, today),
    [movements, today],
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  return (
    <section
      aria-labelledby="radar-inteligente-title"
      className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Radar className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 id="radar-inteligente-title" className="text-sm font-semibold">
            Radar inteligente
          </h3>
          <p className="text-xs text-muted-foreground">
            Señales basadas en los movimientos que ya registraste.
          </p>
        </div>
      </div>

      {isLoading && <SmartDashboardSkeleton />}

      {!isLoading && isError && <QueryError onRetry={() => refetch()} />}

      {!isLoading && !isError && signals.length === 0 && (
        <div className="rounded-xl bg-background/60 px-3 py-3 text-sm text-muted-foreground">
          Todavía no hay señales para mostrar. Registrá movimientos para ver tu ritmo de gastos y próximos vencimientos.
          <Link href="/movimientos" className="ml-1 font-medium text-primary hover:underline">
            Ver movimientos
          </Link>
        </div>
      )}

      {!isLoading && !isError && signals.length > 0 && (
        <div className="space-y-2">
          {signals.map((signal) => {
            const icon =
              signal.kind === "unusual_charge" ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              ) : signal.kind === "spending_pace" ? (
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
              )

            const content =
              signal.kind === "unusual_charge" ? (
                <>
                  <p className="text-sm font-medium">Gasto inusual</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {categoryMap.get(signal.categoryId ?? "") ?? "Un gasto"} fue {signal.ratio.toFixed(1)} veces tu promedio reciente: {formatCurrency(signal.amount, "ARS")}.
                  </p>
                </>
              ) : signal.kind === "spending_pace" ? (
                <>
                  <p className="text-sm font-medium">Ritmo de gastos</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Gastaste {formatCurrency(signal.spent, "ARS")} hasta hoy. Al ritmo actual, podrías cerrar el mes con {formatCurrency(signal.projected, "ARS")}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Próximos movimientos</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Tenés {signal.count} {signal.count === 1 ? "movimiento previsto" : "movimientos previstos"} en los próximos 7 días.
                    {signal.expenseTotal > 0 && ` Incluyen ${formatCurrency(signal.expenseTotal, "ARS")} de gastos.`}
                  </p>
                </>
              )

            const action =
              signal.kind === "spending_pace"
                ? "Ver estadísticas"
                : signal.kind === "upcoming_movements"
                  ? "Revisar próximos"
                  : "Revisar gasto"

            return (
              <div key={signal.id} className="flex items-center gap-3 rounded-xl bg-background/60 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                  {icon}
                </div>
                <div className="min-w-0 flex-1">{content}</div>
                <Link
                  href={signal.href}
                  className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <span className="hidden sm:inline">{action}</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only sm:hidden">{action}</span>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
