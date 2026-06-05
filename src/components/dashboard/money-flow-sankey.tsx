"use client"

import { useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { renderCategoryIcon } from "@/lib/categories"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRightLeft } from "lucide-react"
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts"
import type { NodeProps, LinkProps, SankeyData } from "recharts/types/chart/Sankey"
import type { Tables } from "@/lib/database.types"
import { filterMovements } from "@/lib/stats"
import { fetchAllMovements } from "@/lib/movements"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import {
  chartFiltersToStatsFilter,
  dateFromPreset,
  type ChartFilters,
} from "./chart-filter-bar"
import { useDashboardFilters } from "./dashboard-filters"

type Movement = Tables<"movements">
type Category = Tables<"categories">

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*")
  if (error) throw error
  return data
}

// ─── Color palettes (mirror category-pie-chart) ───────────────────────────────

const INCOME_COLORS_LIGHT = [
  "oklch(0.748 0.219 131.7)",  // lime-green
  "oklch(0.65 0.16 185)",      // teal
  "oklch(0.60 0.17 210)",      // cyan-blue
  "oklch(0.70 0.15 155)",      // green
  "oklch(0.55 0.18 200)",      // deep teal
  "oklch(0.72 0.14 170)",      // mint
]

const INCOME_COLORS_DARK = [
  "oklch(0.82 0.22 131.7)",
  "oklch(0.75 0.18 185)",
  "oklch(0.70 0.19 210)",
  "oklch(0.80 0.17 155)",
  "oklch(0.65 0.20 200)",
  "oklch(0.82 0.16 170)",
]

const TOTAL_COLOR_LIGHT  = "oklch(0.748 0.219 131.7)"
const TOTAL_COLOR_DARK   = "oklch(0.82 0.22 131.7)"

const EXPENSE_COLORS_LIGHT = [
  "oklch(0.577 0.245 27.325)",  // red-orange (matches bar chart "gastos")
  "oklch(0.714 0.213 47.6)",    // orange
  "oklch(0.60 0.15 185)",       // teal
  "oklch(0.75 0.18 95)",        // yellow-green
  "oklch(0.55 0.18 300)",       // purple
  "oklch(0.65 0.18 220)",       // blue
  "oklch(0.6 0.22 20)",         // red
]

const EXPENSE_COLORS_DARK = [
  "oklch(0.704 0.191 22.216)",
  "oklch(0.78 0.21 47.6)",
  "oklch(0.72 0.16 185)",
  "oklch(0.84 0.19 95)",
  "oklch(0.65 0.20 300)",
  "oklch(0.74 0.20 220)",
  "oklch(0.72 0.24 20)",
]

const SAVINGS_COLOR_LIGHT = "oklch(0.748 0.219 131.7)"  // lime
const SAVINGS_COLOR_DARK  = "oklch(0.82 0.22 131.7)"

const DEFICIT_COLOR_LIGHT = "oklch(0.714 0.213 47.6)"   // amber-orange
const DEFICIT_COLOR_DARK  = "oklch(0.78 0.21 47.6)"

const TOP_N_EXPENSE = 5  // matches pie chart
const BALANCE_MIN_SHARE = 0.02  // balance node only shown when diff >= 2% of the larger side

// ─── Node kind type ───────────────────────────────────────────────────────────

type NodeKind = "income" | "total" | "expense" | "savings" | "deficit"

interface SankeyNodeData {
  name: string
  kind: NodeKind
  expenseIdx?: number  // index in expense list for color cycling
  incomeIdx?: number   // index in income list for color cycling
  icon?: string | null // category icon (emoji, URL, or lucide:<name>)
}

// recharts' SankeyNode is augmented with our custom fields when we pass them in data.nodes
type AugmentedPayload = SankeyNodeData & {
  x: number
  y: number
  dx: number
  dy: number
  depth: number
  value?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeColor(kind: NodeKind, idx: number, dark: boolean): string {
  if (kind === "income") {
    const palette = dark ? INCOME_COLORS_DARK : INCOME_COLORS_LIGHT
    return palette[idx % palette.length]
  }
  if (kind === "total")  return dark ? TOTAL_COLOR_DARK  : TOTAL_COLOR_LIGHT
  if (kind === "savings") return dark ? SAVINGS_COLOR_DARK : SAVINGS_COLOR_LIGHT
  if (kind === "deficit") return dark ? DEFICIT_COLOR_DARK : DEFICIT_COLOR_LIGHT
  // expense
  const palette = dark ? EXPENSE_COLORS_DARK : EXPENSE_COLORS_LIGHT
  return palette[idx % palette.length]
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str
}

// ─── Custom node renderer ─────────────────────────────────────────────────────

const FO_HEIGHT = 22
const FO_WIDTH = 150

function makeCustomNode(dark: boolean) {
  return function CustomNode(props: NodeProps) {
    const { x, y, width, height, index, payload } = props
    // payload is SankeyNode (from recharts) plus our custom fields
    const p = payload as unknown as AugmentedPayload
    const kind: NodeKind = p.kind ?? "income"
    const idx = kind === "income" ? (p.incomeIdx ?? 0) : (p.expenseIdx ?? 0)
    const color = nodeColor(kind, idx, dark)
    const name = truncate(p.name ?? "", 16)
    const icon = p.icon ?? null

  // Determine label placement based on depth:
  // depth === 0 → leftmost column (income) → label to the right
  // depth === 1 → center column (total) → label above
  // depth === 2 → rightmost column (expense/savings/deficit) → label to the left
  const depth = p.depth ?? 0

  // Vertically center the foreignObject on the node
  const foY = y + height / 2 - FO_HEIGHT / 2

  const labelNode = (() => {
    if (depth === 1) {
      // center column — plain SVG text above the node
      return (
        <text
          x={x + width / 2}
          y={y - 6}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={11}
          fill="currentColor"
          style={{ fontSize: 11 }}
        >
          {name}
        </text>
      )
    }

    if (depth === 0) {
      // left column — foreignObject to the right with [icon] [name]
      return (
        <foreignObject
          x={x + width + 6}
          y={foY}
          width={FO_WIDTH}
          height={FO_HEIGHT}
        >
          <div
            className="flex items-center gap-1.5 h-full whitespace-nowrap"
          >
            {icon && (
              <span className="flex-shrink-0 leading-none">
                {renderCategoryIcon(icon, { className: "text-sm" })}
              </span>
            )}
            <span className="text-[11px] text-foreground leading-none">{name}</span>
          </div>
        </foreignObject>
      )
    }

    // depth === 2 — right column — foreignObject ending at x - 6 with [name] [icon]
    return (
      <foreignObject
        x={x - 6 - FO_WIDTH}
        y={foY}
        width={FO_WIDTH}
        height={FO_HEIGHT}
      >
        <div
          className="flex items-center justify-end gap-1.5 h-full whitespace-nowrap"
        >
          <span className="text-[11px] text-foreground leading-none">{name}</span>
          {icon && (
            <span className="flex-shrink-0 leading-none">
              {renderCategoryIcon(icon, { className: "text-sm" })}
            </span>
          )}
        </div>
      </foreignObject>
    )
  })()

  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.92}
        radius={3}
      />
      {labelNode}
    </Layer>
  )
  }
}

// ─── Custom link renderer ─────────────────────────────────────────────────────

function makeCustomLink(dark: boolean) {
  return function CustomLink(linkProps: LinkProps) {
    const {
      sourceX, targetX,
      sourceY, targetY,
      sourceControlX, targetControlX,
      linkWidth,
      payload,
      index,
    } = linkProps

    // Color: if source is the central "total" node, use target's color; otherwise use source's color
    const sourcePayload = payload?.source as unknown as AugmentedPayload | undefined
    const targetPayload = payload?.target as unknown as AugmentedPayload | undefined
    const colorNode: AugmentedPayload | undefined =
      sourcePayload?.kind === "total" ? targetPayload : sourcePayload
    const kind: NodeKind = colorNode?.kind ?? "income"
    const idx = kind === "income" ? (colorNode?.incomeIdx ?? 0) : (colorNode?.expenseIdx ?? 0)
    const fillColor = nodeColor(kind, idx, dark)

  const halfW = linkWidth / 2
  const d = `
    M${sourceX},${sourceY - halfW}
    C${sourceControlX},${sourceY - halfW} ${targetControlX},${targetY - halfW} ${targetX},${targetY - halfW}
    L${targetX},${targetY + halfW}
    C${targetControlX},${targetY + halfW} ${sourceControlX},${sourceY + halfW} ${sourceX},${sourceY + halfW}
    Z
  `

  return (
    <path
      key={`link-${index}`}
      d={d}
      fill={fillColor}
      fillOpacity={0.38}
      stroke="none"
    />
  )
  }
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: unknown }> }) {
  if (!active || !payload?.length) return null

  const p = payload[0]?.payload as {
    source?: AugmentedPayload
    target?: AugmentedPayload
    value?: number
    name?: string
    icon?: string | null
  } | undefined

  if (!p) return null

  // Link tooltip
  if (p.source && p.target) {
    return (
      <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow flex items-center gap-1">
        {p.source.icon && (
          <span className="leading-none">{renderCategoryIcon(p.source.icon, { className: "text-sm" })}</span>
        )}
        <span className="text-muted-foreground">{p.source.name}</span>
        <span className="text-muted-foreground mx-0.5">→</span>
        {p.target.icon && (
          <span className="leading-none">{renderCategoryIcon(p.target.icon, { className: "text-sm" })}</span>
        )}
        <span className="text-muted-foreground">{p.target.name}</span>
        <span className="ml-1 font-semibold tabular-nums">
          {formatCurrency(p.value ?? 0, "ARS")}
        </span>
      </div>
    )
  }

  // Node tooltip
  const node = p as unknown as AugmentedPayload
  if (node.name) {
    return (
      <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow flex items-center gap-1.5">
        {node.icon && (
          <span className="leading-none">{renderCategoryIcon(node.icon, { className: "text-sm" })}</span>
        )}
        <span className="font-medium">{node.name}</span>
        {node.value != null && (
          <span className="ml-1 text-muted-foreground tabular-nums">
            {formatCurrency(Number(node.value), "ARS")}
          </span>
        )}
      </div>
    )
  }

  return null
}

// ─── Data aggregation ─────────────────────────────────────────────────────────

interface SankeyResult {
  data: SankeyData & { nodes: SankeyNodeData[] }
  incomeTotal: number
  expenseTotal: number
}

function buildSankeyData(
  movements: Movement[],
  categories: Category[],
): SankeyResult {
  const catMap = new Map(categories.map((c) => [c.id, c]))

  // Sum income and expense by category
  const incomeTotals = new Map<string, number>()
  const expenseTotals = new Map<string, number>()
  let incomeTotal = 0
  let expenseTotal = 0

  for (const m of movements) {
    const amount = m.converted_amount ?? m.amount
    const key = m.category_id ?? "__none__"

    if (m.type === "income") {
      incomeTotal += amount
      incomeTotals.set(key, (incomeTotals.get(key) ?? 0) + amount)
    } else {
      expenseTotal += amount
      expenseTotals.set(key, (expenseTotals.get(key) ?? 0) + amount)
    }
  }

  // Sort expense categories desc, apply top-N + "Otros" grouping
  const sortedExpenses = [...expenseTotals.entries()].sort((a, b) => b[1] - a[1])
  const topExpenses = sortedExpenses.slice(0, TOP_N_EXPENSE)
  const restExpenses = sortedExpenses.slice(TOP_N_EXPENSE)

  const expenseRows: { key: string; value: number }[] = topExpenses.map(([key, value]) => ({
    key,
    value: Math.round(value * 100) / 100,
  }))
  if (restExpenses.length > 0) {
    const othersValue = restExpenses.reduce((s, [, v]) => s + v, 0)
    expenseRows.push({ key: "__others__", value: Math.round(othersValue * 100) / 100 })
  }

  // Build nodes array
  const nodes: SankeyNodeData[] = []

  // Determine if we need a deficit source node
  const needsDeficit = expenseTotal > incomeTotal
  const diff = Math.abs(incomeTotal - expenseTotal)
  const balanceSignificant = diff > 0 && diff >= BALANCE_MIN_SHARE * Math.max(incomeTotal, expenseTotal)

  // Add deficit node first (it's a source, leftmost column)
  if (needsDeficit && balanceSignificant) {
    nodes.push({ name: "Uso de ahorros", kind: "deficit" })
  }

  // Income category nodes
  const incomeStart = nodes.length
  const sortedIncome = [...incomeTotals.entries()].sort((a, b) => b[1] - a[1])
  for (let i = 0; i < sortedIncome.length; i++) {
    const [key] = sortedIncome[i]
    const cat = catMap.get(key)
    const name = key === "__none__"
      ? "Sin categoría (ing.)"
      : (cat?.name ?? "Sin categoría")
    const icon = key === "__none__" ? null : (cat?.icon ?? null)
    nodes.push({ name, kind: "income", incomeIdx: i, icon })
  }

  // Central total node
  const totalIdx = nodes.length
  nodes.push({ name: "Ingresos totales", kind: "total" })

  // Expense category nodes
  const expenseStart = nodes.length
  for (let i = 0; i < expenseRows.length; i++) {
    const { key } = expenseRows[i]
    const cat = catMap.get(key)
    const name = key === "__others__"
      ? "Otras categorías"
      : key === "__none__"
        ? "Sin categoría (egr.)"
        : (cat?.name ?? "Sin categoría")
    const icon = key === "__others__" || key === "__none__" ? null : (cat?.icon ?? null)
    nodes.push({ name, kind: "expense", expenseIdx: i, icon })
  }

  // Savings or deficit node
  const hasSavings = incomeTotal > expenseTotal && balanceSignificant
  if (hasSavings) {
    nodes.push({ name: "Ahorro", kind: "savings" })
  }

  // Build links
  const links: { source: number; target: number; value: number }[] = []

  // Deficit → total central
  if (needsDeficit && balanceSignificant) {
    links.push({ source: 0, target: totalIdx, value: Math.round(diff * 100) / 100 })
  }

  // Income categories → total central
  sortedIncome.forEach(([, value], i) => {
    links.push({
      source: incomeStart + i,
      target: totalIdx,
      value: Math.round(value * 100) / 100,
    })
  })

  // Total central → expense categories
  expenseRows.forEach(({ value }, i) => {
    links.push({
      source: totalIdx,
      target: expenseStart + i,
      value,
    })
  })

  // Total central → savings
  if (hasSavings) {
    links.push({
      source: totalIdx,
      target: nodes.length - 1,
      value: Math.round(diff * 100) / 100,
    })
  }

  return {
    data: { nodes, links },
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    expenseTotal: Math.round(expenseTotal * 100) / 100,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MoneyFlowSankey() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [date, setDate] = useState<DateRangeValue>(() => dateFromPreset("this_month"))
  const { accountIds, categoryIds } = useDashboardFilters()

  const filters: ChartFilters = { date, accountIds, categoryIds }

  const { data: allMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const isLoading = loadingMovements || loadingCategories

  const statsFilter = useMemo(
    () => chartFiltersToStatsFilter(filters, "all"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, accountIds, categoryIds],
  )

  const filtered = useMemo(
    () => (allMovements ? filterMovements(allMovements, statsFilter) : []),
    [allMovements, statsFilter],
  )

  const result = useMemo<SankeyResult | null>(() => {
    if (!filtered.length || !categories) return null
    const r = buildSankeyData(filtered, categories)
    // Must have at least one link to render the chart
    if (r.data.links.length === 0) return null
    return r
  }, [filtered, categories])

  const CustomNode = useMemo(() => makeCustomNode(isDark), [isDark])
  const CustomLink = useMemo(() => makeCustomLink(isDark), [isDark])

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Flujo del mes</h3>
        <DateRangeFilter
          value={date}
          onChange={setDate}
          triggerClassName="min-w-0"
        />
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-4 h-64">
            <div className="flex flex-col gap-2 w-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-2 rounded" style={{ height: `${20 + i * 10}%` }} />
              ))}
            </div>
            <Skeleton className="flex-1 h-full rounded-xl" />
            <div className="flex flex-col gap-2 w-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-2 rounded" style={{ height: `${15 + i * 8}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !result && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin datos para el período y filtros seleccionados.</p>
        </div>
      )}

      {/* Chart */}
      {!isLoading && result && (
        <>
          <div className="h-72 sm:h-80 md:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={result.data as SankeyData}
                node={CustomNode as unknown as Parameters<typeof Sankey>[0]["node"]}
                link={CustomLink as unknown as Parameters<typeof Sankey>[0]["link"]}
                nodePadding={14}
                nodeWidth={12}
                margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
                sort={false}
              >
                <Tooltip content={<CustomTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          </div>

          {/* Summary row */}
          <div className="flex gap-4 pt-2 text-xs border-t border-border/40">
            <div className="flex-1 text-center">
              <p className="text-muted-foreground mb-0.5">Ingresos</p>
              <p className="font-semibold tabular-nums text-success">
                {formatCurrency(result.incomeTotal, "ARS")}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-muted-foreground mb-0.5">Gastos</p>
              <p className="font-semibold tabular-nums text-destructive">
                {formatCurrency(result.expenseTotal, "ARS")}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-muted-foreground mb-0.5">Balance</p>
              {(() => {
                const diff = result.incomeTotal - result.expenseTotal
                return (
                  <p className={`font-semibold tabular-nums ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                    {diff >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(diff), "ARS")}
                  </p>
                )
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
