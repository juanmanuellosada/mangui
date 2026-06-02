"use client"

import { useMemo, useState } from "react"
import { PieChart, ChevronRight } from "lucide-react"
import {
  EvilPieChart,
  Pie,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/pie-chart"
import type { ChartConfig } from "@/components/evilcharts/ui/chart"
import { formatCurrency, cn } from "@/lib/utils"
import type { CategoryDistributionItem } from "@/lib/stats"
import Link from "next/link"

interface CategoryDistributionChartProps {
  items: CategoryDistributionItem[]
  type: "income" | "expense"
  currency?: "ARS" | "USD"
}

const COLORS_LIGHT = [
  "oklch(0.748 0.219 131.7)",
  "oklch(0.714 0.213 47.6)",
  "oklch(0.60 0.15 185)",
  "oklch(0.75 0.18 95)",
  "oklch(0.55 0.18 300)",
  "oklch(0.6 0.22 20)",
  "oklch(0.65 0.18 220)",
]

const COLORS_DARK = [
  "oklch(0.82 0.22 131.7)",
  "oklch(0.78 0.21 47.6)",
  "oklch(0.72 0.16 185)",
  "oklch(0.84 0.19 95)",
  "oklch(0.65 0.20 300)",
  "oklch(0.72 0.24 20)",
  "oklch(0.74 0.20 220)",
]

const TOP_N = 6

export function CategoryDistributionChart({ items, type, currency = "ARS" }: CategoryDistributionChartProps) {
  const [expanded, setExpanded] = useState(false)

  const { chartData, config, total } = useMemo(() => {
    const top = items.slice(0, TOP_N)
    const rest = items.slice(TOP_N)
    const cfg: ChartConfig = {}
    const rows: { name: string; value: number; categoryId: string }[] = []

    top.forEach((item, idx) => {
      rows.push({ name: item.name, value: Math.round(item.total), categoryId: item.categoryId })
      cfg[item.name] = {
        label: item.name,
        colors: {
          light: [COLORS_LIGHT[idx % COLORS_LIGHT.length]],
          dark: [COLORS_DARK[idx % COLORS_DARK.length]],
        },
      }
    })

    if (rest.length > 0) {
      const othersTotal = rest.reduce((s, i) => s + i.total, 0)
      rows.push({ name: "Otros", value: Math.round(othersTotal), categoryId: "" })
      cfg["Otros"] = {
        label: "Otros",
        colors: {
          light: [COLORS_LIGHT[TOP_N % COLORS_LIGHT.length]],
          dark: [COLORS_DARK[TOP_N % COLORS_DARK.length]],
        },
      }
    }

    const total = items.reduce((s, i) => s + i.total, 0)
    return { chartData: rows, config: cfg, total }
  }, [items])

  const label = type === "expense" ? "Gastos por categoría" : "Ingresos por categoría"
  const displayItems = expanded ? items : items.slice(0, 5)

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">{label}</h3>
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
          <PieChart className="h-10 w-10 text-muted-foreground/30" aria-hidden />
          <p className="text-sm text-muted-foreground">Sin datos para el período.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold">{label}</h3>

      <EvilPieChart
        config={config}
        data={chartData}
        dataKey="value"
        nameKey="name"
        className="h-52"
      >
        <Pie innerRadius="52%" outerRadius="78%" cornerRadius={4} paddingAngle={2} isClickable />
        <Tooltip />
        <Legend variant="rounded-square" />
      </EvilPieChart>

      <div className="border-t border-border/40 pt-3 space-y-1.5">
        {displayItems.map((item) => (
          <Link
            key={item.categoryId || item.name}
            href={`/app/movimientos?categoryId=${item.categoryId}&type=${type}`}
            className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
            aria-label={`Ver movimientos de ${item.name}`}
          >
            <span className="text-xs text-muted-foreground truncate flex-1">{item.name}</span>
            <span className="text-xs font-semibold tabular-nums">
              {formatCurrency(item.total, currency)}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">
              {item.percent.toFixed(1)}%
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" aria-hidden />
          </Link>
        ))}

        {items.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-primary font-medium py-1 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {expanded ? "Mostrar menos" : `Ver ${items.length - 5} más`}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <p className="text-xs text-muted-foreground">Total {type === "expense" ? "gastos" : "ingresos"}</p>
        <p className={cn("text-sm font-bold tabular-nums", type === "expense" ? "text-destructive" : "text-success")}>
          {formatCurrency(total, currency)}
        </p>
      </div>
    </div>
  )
}
