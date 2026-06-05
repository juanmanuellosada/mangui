"use client"

import { useMemo } from "react"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRightLeft } from "lucide-react"
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts"
import type { NodeProps, LinkProps, SankeyData } from "recharts/types/chart/Sankey"
import type { Tables } from "@/lib/database.types"
import { startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"

type Movement = Tables<"movements">
type Category = Tables<"categories">

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchCurrentMonthMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const now = new Date()
  const from = format(startOfMonth(now), "yyyy-MM-dd")
  const to = format(endOfMonth(now), "yyyy-MM-dd")
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .gte("date", from)
    .lte("date", to)
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*")
  if (error) throw error
  return data
}

// ─── Color palettes (mirror category-pie-chart) ───────────────────────────────

const INCOME_COLOR_LIGHT = "oklch(0.748 0.219 131.7)"   // lime
const INCOME_COLOR_DARK  = "oklch(0.82 0.22 131.7)"

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

function nodeColor(kind: NodeKind, expenseIdx: number, dark: boolean): string {
  if (kind === "income") return dark ? INCOME_COLOR_DARK : INCOME_COLOR_LIGHT
  if (kind === "total")  return dark ? TOTAL_COLOR_DARK  : TOTAL_COLOR_LIGHT
  if (kind === "savings") return dark ? SAVINGS_COLOR_DARK : SAVINGS_COLOR_LIGHT
  if (kind === "deficit") return dark ? DEFICIT_COLOR_DARK : DEFICIT_COLOR_LIGHT
  // expense
  const palette = dark ? EXPENSE_COLORS_DARK : EXPENSE_COLORS_LIGHT
  return palette[expenseIdx % palette.length]
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str
}

// ─── Custom node renderer ─────────────────────────────────────────────────────

function makeCustomNode(dark: boolean) {
  return function CustomNode(props: NodeProps) {
    const { x, y, width, height, index, payload } = props
    // payload is SankeyNode (from recharts) plus our custom fields
    const p = payload as unknown as AugmentedPayload
    const kind: NodeKind = p.kind ?? "income"
    const expenseIdx = p.expenseIdx ?? 0
    const color = nodeColor(kind, expenseIdx, dark)
    const name = truncate(p.name ?? "", 16)

  // Determine label placement based on depth:
  // depth === 0 → leftmost column (income) → label to the right
  // depth === 1 → center column (total) → label above
  // depth === 2 → rightmost column (expense/savings/deficit) → label to the left
  const depth = p.depth ?? 0
  const LABEL_OFFSET = width + 6

  let textX: number
  let textY: number
  let textAnchor: "start" | "middle" | "end"
  let dominantBaseline: "middle" | "auto"

  if (depth === 0) {
    textX = x + LABEL_OFFSET
    textY = y + height / 2
    textAnchor = "start"
    dominantBaseline = "middle"
  } else if (depth === 2) {
    textX = x - 6
    textY = y + height / 2
    textAnchor = "end"
    dominantBaseline = "middle"
  } else {
    // center column — label above the node, horizontally centered
    textX = x + width / 2
    textY = y - 6
    textAnchor = "middle"
    dominantBaseline = "auto"
  }

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
      <text
        x={textX}
        y={textY}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
        fontSize={11}
        fill="currentColor"
        style={{ fontSize: 11 }}
      >
        {name}
      </text>
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

    // Color based on source node kind
    const sourcePayload = payload?.source as unknown as AugmentedPayload | undefined
    const kind: NodeKind = sourcePayload?.kind ?? "income"
    const expenseIdx = sourcePayload?.expenseIdx ?? 0
    const fillColor = nodeColor(kind, expenseIdx, dark)

  const d = `
    M${sourceX},${sourceY}
    C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
    L${targetX},${targetY + linkWidth}
    C${targetControlX},${targetY + linkWidth} ${sourceControlX},${sourceY + linkWidth} ${sourceX},${sourceY + linkWidth}
    Z
  `

  return (
    <path
      key={`link-${index}`}
      d={d}
      fill={fillColor}
      fillOpacity={0.28}
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
  } | undefined

  if (!p) return null

  // Link tooltip
  if (p.source && p.target) {
    return (
      <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow">
        <span className="text-muted-foreground">{p.source.name}</span>
        {" → "}
        <span className="text-muted-foreground">{p.target.name}</span>
        <span className="ml-2 font-semibold tabular-nums">
          {formatCurrency(p.value ?? 0, "ARS")}
        </span>
      </div>
    )
  }

  // Node tooltip
  const node = p as unknown as AugmentedPayload
  if (node.name) {
    return (
      <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow">
        <span className="font-medium">{node.name}</span>
        {node.value != null && (
          <span className="ml-2 text-muted-foreground tabular-nums">
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
  for (const [key] of sortedIncome) {
    const cat = catMap.get(key)
    const name = key === "__none__"
      ? "Sin categoría (ing.)"
      : (cat?.name ?? "Sin categoría")
    nodes.push({ name, kind: "income" })
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
    nodes.push({ name, kind: "expense", expenseIdx: i })
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

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "current-month-all"],
    queryFn: fetchCurrentMonthMovements,
  })

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const isLoading = loadingMovements || loadingCategories

  const monthLabel = format(new Date(), "MMMM yyyy", { locale: es })
    .replace(/^\w/, (c) => c.toUpperCase())

  const result = useMemo<SankeyResult | null>(() => {
    if (!movements || !categories) return null
    if (movements.length === 0) return null
    const r = buildSankeyData(movements, categories)
    // Must have at least one link to render the chart
    if (r.data.links.length === 0) return null
    return r
  }, [movements, categories])

  const CustomNode = useMemo(() => makeCustomNode(isDark), [isDark])
  const CustomLink = useMemo(() => makeCustomLink(isDark), [isDark])

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Flujo del mes</h3>
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
          {monthLabel}
        </span>
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
          <p className="text-sm text-muted-foreground">Sin datos este mes todavía.</p>
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
