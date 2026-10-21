"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarClock, ChevronRight, Radar, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories } from "@/lib/hooks/use-categories"
import { fetchAllMovements } from "@/lib/movements"
import { todayAR } from "@/lib/date-utils"
import { buildSmartDashboardSignals } from "@/lib/dashboard/smart-dashboard"
import { formatCurrency } from "@/lib/utils"

const actionClassName = "inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground underline decoration-primary underline-offset-4 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function SmartDashboardSkeleton() {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Cargando señales del Radar</span>
      <div aria-hidden="true" className="space-y-3 motion-reduce:[&_*]:animate-none">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
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
          <Radar className="h-4 w-4 text-foreground" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 id="radar-inteligente-title" className="text-base font-semibold">
            Radar inteligente
          </h3>
          <p className="text-sm text-muted-foreground">
            Señales basadas en tus movimientos registrados.
          </p>
        </div>
      </div>

      {isLoading && <SmartDashboardSkeleton />}

      {!isLoading && isError && (
        <div role="alert" className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 space-y-2">
            <p className="text-sm leading-relaxed">
              No pudimos cargar las señales del Radar. Reintentá para ver tus registros actualizados.
            </p>
            <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !isError && signals.length === 0 && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {movements.length === 0 ? "Registrá tus primeros movimientos" : "Sin señales para hoy"}
          </p>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {movements.length === 0
              ? "El Radar usa tus registros para mostrar gastos inusuales, estimar el cierre del mes y anticipar movimientos previstos."
              : "Con tus registros actuales no hay señales para mostrar. Podés revisar o sumar movimientos."}
          </p>
          <Link href="/movimientos" className={actionClassName}>
            Ver movimientos <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {!isLoading && !isError && signals.length > 0 && (
        <>
          <ul className="divide-y divide-border/60" aria-label="Señales del Radar">
            {signals.map((signal) => {
              const needsReview = signal.kind === "unusual_charge"
              const Icon = needsReview
                ? AlertTriangle
                : signal.kind === "spending_pace" ? TrendingUp : CalendarClock
              const label = needsReview
                ? "Para revisar"
                : signal.kind === "spending_pace" ? "Proyección" : "Próximos 7 días"
              const action = needsReview
                ? "Revisar gasto"
                : signal.kind === "spending_pace" ? "Ver estadísticas" : "Ver previstos"

              return (
                <li key={signal.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
                  <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${needsReview ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-foreground"}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1 break-words">
                    <p className={`text-xs font-medium ${needsReview ? "text-amber-900 dark:text-amber-200" : "text-muted-foreground"}`}>
                      {label}
                    </p>
                    {signal.kind === "unusual_charge" ? (
                      <>
                        <h4 className="text-sm font-semibold">Gasto inusual</h4>
                        <p className="text-sm leading-relaxed">
                          {categoryMap.get(signal.categoryId ?? "") ?? "Esta categoría"}: {formatCurrency(signal.amount, "ARS")}.
                          {" Es "}{signal.ratio.toLocaleString("es-AR", { maximumFractionDigits: 1 })} veces el promedio reciente de esa categoría.
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Puede ser una compra puntual. Comparala con tus registros.
                        </p>
                      </>
                    ) : signal.kind === "spending_pace" ? (
                      <>
                        <h4 className="text-sm font-semibold">Cierre de mes estimado</h4>
                        <p className="text-sm leading-relaxed">
                          {formatCurrency(signal.projected, "ARS")} si mantenés este ritmo.
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Llevás {formatCurrency(signal.spent, "ARS")} de gastos este mes. Es una estimación, no un límite de gasto.
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="text-sm font-semibold">
                          {signal.count} {signal.count === 1 ? "movimiento previsto" : "movimientos previstos"}
                        </h4>
                        {signal.expenseTotal > 0 && (
                          <p className="text-sm leading-relaxed">
                            {formatCurrency(signal.expenseTotal, "ARS")} de gastos previstos.
                          </p>
                        )}
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Solo incluye los movimientos previstos que registraste.
                        </p>
                      </>
                    )}
                  </div>
                  <Link href={signal.href} className={`${actionClassName} col-start-2 justify-self-start sm:col-start-3 sm:self-center`}>
                    {action} <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Montos en pesos (ARS). Los movimientos en otra moneda solo se suman si tienen conversión registrada.
          </p>
        </>
      )}
    </section>
  )
}
