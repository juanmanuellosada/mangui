"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Share2, Loader2, TrendingDown, TrendingUp } from "lucide-react"
import { format, parse, startOfMonth, endOfMonth } from "date-fns"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MoneyFlowSankeyChart } from "@/components/dashboard/money-flow-sankey-chart"
import { useCategories } from "@/lib/hooks/use-categories"
import { useInflationIndex } from "@/lib/inflation/use-inflation-index"
import { buildIpcMap } from "@/lib/inflation/adjust"
import { fetchAllMovements } from "@/lib/movements"
import { filterMovements } from "@/lib/stats"
import { buildWrappedData } from "@/lib/wrapped"
import { formatCurrency, cn } from "@/lib/utils"
import { renderCategoryIcon } from "@/lib/categories"

interface WrappedSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mes a mostrar, formato "yyyy-MM". */
  monthRef: string
}

const CATEGORY_BAR_COLORS = ["bg-primary", "bg-accent", "bg-sky-500"]

export function WrappedSheet({ open, onOpenChange, monthRef }: WrappedSheetProps) {
  const [sharing, setSharing] = useState(false)

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
    enabled: open,
  })
  const { data: categories, isLoading: loadingCategories } = useCategories({ orderBy: "none" })
  const { data: inflationRows } = useInflationIndex()

  const ipc = useMemo(() => buildIpcMap(inflationRows ?? []), [inflationRows])

  const isLoading = loadingMovements || loadingCategories

  const wrapped = useMemo(() => {
    if (!movements || !categories) return null
    return buildWrappedData(movements, categories, monthRef, {
      currency: "ARS",
      ipc,
      previousMonthMovements: movements,
    })
  }, [movements, categories, monthRef, ipc])

  const monthMovements = useMemo(() => {
    if (!movements) return []
    const monthDate = parse(`${monthRef}-01`, "yyyy-MM-dd", new Date())
    return filterMovements(movements, {
      dateFrom: format(startOfMonth(monthDate), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(monthDate), "yyyy-MM-dd"),
    })
  }, [movements, monthRef])

  const monthLabel = wrapped?.monthLabel ?? ""
  const title = monthLabel ? `Tu ${monthLabel} en mangui 🥭` : "Tu resumen en mangui"

  const showRealVsNominal =
    wrapped?.realVsNominal.adjusted != null &&
    wrapped.realVsNominal.deltaPct != null &&
    Math.abs(wrapped.realVsNominal.deltaPct) >= 1

  async function handleShare() {
    setSharing(true)
    try {
      const res = await fetch(`/api/og/wrapped?month=${monthRef}`)
      if (!res.ok) throw new Error("No se pudo generar la imagen")
      const blob = await res.blob()
      const file = new File([blob], "mangui-wrapped.png", { type: "image/png" })
      const shareData = {
        files: [file],
        title: "Mi resumen de mangui",
        text: `Mi ${monthLabel} en mangui 🥭`,
      }
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "mangui-wrapped.png"
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success("Imagen descargada")
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return // el usuario canceló el share sheet
      toast.error("No pudimos generar tu resumen. Probá de nuevo.")
    } finally {
      setSharing(false)
    }
  }

  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={wrapped?.hasData ? "Cerrado, con IA y con onda." : undefined}
      footer={
        wrapped?.hasData ? (
          <Button className="w-full font-semibold gap-2 press-effect" onClick={handleShare} disabled={sharing}>
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {sharing ? "Generando…" : "Compartir"}
          </Button>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-2/3 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}

      {!isLoading && wrapped && !wrapped.hasData && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="text-4xl">🥭</span>
          <p className="text-sm text-muted-foreground max-w-xs">
            Todavía no cargaste movimientos en {monthLabel}. Anotalos en mangui para ver tu resumen.
          </p>
        </div>
      )}

      {!isLoading && wrapped && wrapped.hasData && (
        <div className="space-y-5">
          {/* Hero: gasto total */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gastaste</p>
            <p
              className="text-3xl sm:text-4xl font-bold tabular-nums leading-none mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatCurrency(wrapped.totalExpense, "ARS")}
            </p>
            {wrapped.vsPreviousMonth?.deltaPct != null && (
              <p
                className={cn(
                  "text-sm font-medium mt-1.5 flex items-center gap-1",
                  wrapped.vsPreviousMonth.deltaPct <= 0 ? "text-success" : "text-destructive"
                )}
              >
                {wrapped.vsPreviousMonth.deltaPct <= 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                {wrapped.vsPreviousMonth.deltaPct >= 0 ? "+" : ""}
                {wrapped.vsPreviousMonth.deltaPct.toFixed(0)}% vs. el mes anterior
              </p>
            )}
          </div>

          {/* Ingresos / Ahorro */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-muted/50 p-3.5">
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">
                {formatCurrency(wrapped.totalIncome, "ARS")}
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-muted/50 p-3.5">
              <p className="text-xs text-muted-foreground">{wrapped.net >= 0 ? "Ahorro" : "Déficit"}</p>
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums mt-0.5",
                  wrapped.net >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatCurrency(Math.abs(wrapped.net), "ARS")}
              </p>
            </div>
          </div>

          {/* Top categorías */}
          {wrapped.topCategories.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                En qué se te fue la plata
              </p>
              {wrapped.topCategories.map((cat, i) => (
                <div key={cat.categoryId || cat.name} className="flex items-center gap-2.5">
                  <span className="shrink-0 text-muted-foreground">{renderCategoryIcon(cat.icon, { className: "h-4 w-4" })}</span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{cat.name}</span>
                      <span className="text-sm font-semibold tabular-nums shrink-0">
                        {formatCurrency(cat.amount, "ARS")}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length])}
                        style={{ width: `${Math.min(100, cat.percent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Real vs nominal — el ángulo argentino */}
          {showRealVsNominal && wrapped.realVsNominal.adjusted != null && wrapped.realVsNominal.deltaPct != null && (
            <div className="rounded-2xl bg-muted/50 p-3.5 space-y-1">
              <p className="text-xs text-muted-foreground">Ese mismo gasto, en pesos de hoy</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(wrapped.realVsNominal.adjusted, "ARS")}{" "}
                <span className="text-sm font-normal text-accent">
                  (+{wrapped.realVsNominal.deltaPct.toFixed(0)}% por inflación)
                </span>
              </p>
            </div>
          )}

          {/* Sankey: cómo se movió la plata */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Cómo se movió tu plata
            </p>
            <MoneyFlowSankeyChart movements={monthMovements} categories={categories ?? []} />
          </div>
        </div>
      )}
    </MangoSheet>
  )
}
