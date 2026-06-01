"use client"

import { useMemo, useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  filterMovements,
  summaryTotals,
  categoryDistribution,
  incomeExpenseSeries,
  weekdayPattern,
  recurringMonthlyProjection,
} from "@/lib/stats"
import { StatsFilterBar, defaultFilter, filterToStatsFilter, type FilterState, type DateRangeValue } from "./stats-filter-bar"
import { SummaryCards } from "./summary-cards"
import { CategoryDistributionChart } from "./category-distribution-chart"
import { IncomeExpenseSeriesChart } from "./income-expense-series-chart"
import { WeekdayPatternBars } from "./weekday-pattern-chart"
import { BudgetComplianceStrip } from "./budget-compliance-strip"
import { CompareTab } from "./compare-tab"
import type { Tables } from "@/lib/database.types"
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns"
import { getPreset } from "@/lib/date-ranges"
import { es } from "date-fns/locale"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">
type Budget = Tables<"budgets">
type RecurringTransaction = Tables<"recurring_transactions">

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .limit(2000)
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*").order("name")
  if (error) throw error
  return data
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("accounts").select("*").order("name")
  if (error) throw error
  return data
}

async function fetchBudgets(): Promise<Budget[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("status", "active")
  if (error) throw error
  return data
}

async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("status", "active")
  if (error) throw error
  return data
}

// ── Export helpers ────────────────────────────────────────────────────────────

async function exportAllData() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const tables = [
    "accounts", "categories", "movements", "transfers",
    "installment_purchases", "card_statements", "recurring_transactions",
    "recurring_occurrences", "scheduled_transactions",
    "auto_rules", "auto_rule_conditions",
    "budgets", "goals", "saved_views", "user_preferences", "profiles",
  ] as const

  const result: Record<string, unknown[]> = {}

  for (const table of tables) {
    try {
      const { data } = await supabase.from(table).select("*")
      result[table] = data ?? []
    } catch {
      result[table] = []
    }
  }

  const dateStr = format(new Date(), "yyyy-MM-dd")
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `mangui-export-${dateStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function generateMonthlyReport(
  movements: Movement[],
  categories: Category[],
  budgets: Budget[],
  month: Date,
  currency: "ARS" | "USD"
): string {
  const from = format(startOfMonth(month), "yyyy-MM-dd")
  const to = format(endOfMonth(month), "yyyy-MM-dd")
  const monthName = format(month, "MMMM yyyy", { locale: es })

  const monthMovs = filterMovements(movements, { dateFrom: from, dateTo: to })
  const totals = summaryTotals(monthMovs, currency)
  const expCats = categoryDistribution(monthMovs, "expense", categories, currency)
  const incCats = categoryDistribution(monthMovs, "income", categories, currency)

  // Previous month for comparison
  const prevMonth = subMonths(month, 1)
  const prevFrom = format(startOfMonth(prevMonth), "yyyy-MM-dd")
  const prevTo = format(endOfMonth(prevMonth), "yyyy-MM-dd")
  const prevMovs = filterMovements(movements, { dateFrom: prevFrom, dateTo: prevTo })
  const prevTotals = summaryTotals(prevMovs, currency)

  const fmtDelta = (a: number, b: number) => {
    if (b === 0) return ""
    const pct = ((a - b) / b) * 100
    return ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs mes anterior)`
  }

  const lines: string[] = [
    `# Reporte mensual — ${monthName}`,
    `Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`,
    "",
    "## Resumen",
    "",
    `- **Ingresos:** ${formatCurrency(totals.income, currency)}${fmtDelta(totals.income, prevTotals.income)}`,
    `- **Gastos:** ${formatCurrency(totals.expense, currency)}${fmtDelta(totals.expense, prevTotals.expense)}`,
    `- **Balance neto:** ${totals.net >= 0 ? "+" : ""}${formatCurrency(totals.net, currency)}`,
    `- **Movimientos:** ${monthMovs.length}`,
    "",
  ]

  if (expCats.length > 0) {
    lines.push("## Top categorías de gasto", "")
    expCats.slice(0, 8).forEach((c, i) => {
      lines.push(`${i + 1}. **${c.name}:** ${formatCurrency(c.total, currency)} (${c.percent.toFixed(1)}%)`)
    })
    lines.push("")
  }

  if (incCats.length > 0) {
    lines.push("## Fuentes de ingresos", "")
    incCats.slice(0, 5).forEach((c, i) => {
      lines.push(`${i + 1}. **${c.name}:** ${formatCurrency(c.total, currency)} (${c.percent.toFixed(1)}%)`)
    })
    lines.push("")
  }

  const activeBudgets = budgets.filter((b) => b.status === "active")
  if (activeBudgets.length > 0) {
    lines.push("## Presupuestos", "")
    // Note: progress requires movement rows in specific shape; do basic spend comparison
    activeBudgets.forEach((b) => {
      lines.push(`- **${b.name}:** límite ${formatCurrency(b.limit_amount, b.currency)}`)
    })
    lines.push("")
  }

  lines.push("---", "_Exportado desde mangui_")

  return lines.join("\n")
}

// ── Main component ────────────────────────────────────────────────────────────

type TabKey = "resumen" | "comparar"

export function StatsPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeTab = (searchParams.get("tab") as TabKey) || "resumen"

  const [filter, setFilter] = useState<FilterState>(() => defaultFilter())
  const [isExporting, setIsExporting] = useState(false)

  const [period1, setPeriod1] = useState<DateRangeValue>(() => {
    const r = getPreset("this_month")
    return { operator: "between", preset: "this_month", from: r.from, to: r.to, label: r.label }
  })
  const [period2, setPeriod2] = useState<DateRangeValue>(() => {
    const r = getPreset("last_month")
    return { operator: "between", preset: "last_month", from: r.from, to: r.to, label: r.label }
  })

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchMovements,
  })

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts", "stats"],
    queryFn: fetchAccounts,
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", "stats"],
    queryFn: fetchBudgets,
  })

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring_transactions", "stats"],
    queryFn: fetchRecurring,
  })

  const isLoading = loadingMovements || loadingCategories || loadingAccounts

  const statsFilter = filterToStatsFilter(filter)
  const currency = filter.currency !== "all" ? filter.currency : "ARS"

  const filtered = useMemo(() => filterMovements(movements, statsFilter), [movements, statsFilter])
  const totals = useMemo(() => summaryTotals(filtered, statsFilter.currency), [filtered, statsFilter.currency])

  const expenseDistribution = useMemo(
    () => categoryDistribution(filtered, "expense", categories, statsFilter.currency),
    [filtered, categories, statsFilter.currency]
  )
  const incomeDistribution = useMemo(
    () => categoryDistribution(filtered, "income", categories, statsFilter.currency),
    [filtered, categories, statsFilter.currency]
  )

  const series = useMemo(
    () => incomeExpenseSeries(movements, "month", 6, statsFilter.currency),
    [movements, statsFilter.currency]
  )

  const weekdayData = useMemo(
    () => weekdayPattern(filtered, statsFilter.currency),
    [filtered, statsFilter.currency]
  )

  const projection = useMemo(
    () => recurringMonthlyProjection(recurring),
    [recurring]
  )

  const periodLabel = useMemo(() => {
    if (filter.date.label) return filter.date.label
    const from = filter.date.from ? format(parseISO(filter.date.from), "d MMM", { locale: es }) : ""
    const to = filter.date.to ? format(parseISO(filter.date.to), "d MMM", { locale: es }) : ""
    return from && to ? `${from} – ${to}` : from || to
  }, [filter.date])

  function setTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.replace(`?${params.toString()}`)
  }

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      await exportAllData()
      toast.success("Exportación completada")
    } catch {
      toast.error("No se pudo exportar")
    } finally {
      setIsExporting(false)
    }
  }, [])

  function handleMonthlyReport() {
    try {
      const report = generateMonthlyReport(
        movements,
        categories,
        budgets,
        new Date(),
        currency
      )
      const monthStr = format(new Date(), "yyyy-MM", { locale: es })
      const blob = new Blob([report], { type: "text/markdown;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `reporte-mangui-${monthStr}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Reporte generado")
    } catch {
      toast.error("No se pudo generar el reporte")
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Estadísticas</h1>
          {periodLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
          )}
        </div>
        <BarChart3 className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden />
      </div>

      {/* Filter bar */}
      <StatsFilterBar
        filter={filter}
        categories={categories}
        accounts={accounts}
        onChange={setFilter}
        tab={activeTab}
        onTabChange={setTab}
        period1={period1}
        period2={period2}
        onPeriod1Change={setPeriod1}
        onPeriod2Change={setPeriod2}
        onRestoreSharedFilter={(sf) =>
          setFilter((f) => ({ ...f, type: sf.type, categoryIds: sf.categoryIds, accountIds: sf.accountIds, currency: sf.currency }))
        }
      />

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      )}

      {/* Resumen tab */}
      {!isLoading && activeTab === "resumen" && (
        <div className="space-y-5">
          <SummaryCards totals={totals} currency={currency} period={periodLabel} />

          {/* Charts row 1: category distributions side-by-side on lg+ */}
          <div className={incomeDistribution.length > 0 ? "grid grid-cols-1 lg:grid-cols-2 gap-5" : undefined}>
            <CategoryDistributionChart
              items={expenseDistribution}
              type="expense"
              currency={currency}
            />
            {incomeDistribution.length > 0 && (
              <CategoryDistributionChart
                items={incomeDistribution}
                type="income"
                currency={currency}
              />
            )}
          </div>

          {/* Charts row 2: time series + weekday pattern side-by-side on lg+ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Income/Expense over time */}
            <IncomeExpenseSeriesChart data={series} currency={currency} />

            {/* Weekday pattern */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Patrón por día de la semana</h3>
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                  por total
                </span>
              </div>
              <WeekdayPatternBars data={weekdayData} currency={currency} />
            </div>
          </div>

          {/* Budget compliance */}
          <BudgetComplianceStrip budgets={budgets} movements={movements} />

          {/* Recurring projection card */}
          {(projection.monthlyIncome > 0 || projection.monthlyExpense > 0) && (
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h3 className="text-sm font-semibold">Proyección recurrentes (mensual)</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Ingresos</p>
                  <p className="text-sm font-bold tabular-nums text-success">
                    +{formatCurrency(projection.monthlyIncome, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Gastos</p>
                  <p className="text-sm font-bold tabular-nums text-destructive">
                    -{formatCurrency(projection.monthlyExpense, currency)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Impacto mensual estimado de tus transacciones recurrentes activas.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Acciones rápidas</h3>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleMonthlyReport}
              >
                <FileText className="h-4 w-4" aria-hidden />
                Reporte mensual
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" aria-hidden />
                {isExporting ? "Exportando..." : "Exportar datos"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparar tab */}
      {!isLoading && activeTab === "comparar" && (
        <CompareTab
          movements={movements}
          categories={categories}
          currency={currency}
          period1={period1}
          period2={period2}
          sharedFilter={{
            type: filter.type,
            categoryIds: filter.categoryIds,
            accountIds: filter.accountIds,
          }}
        />
      )}
    </div>
  )
}
