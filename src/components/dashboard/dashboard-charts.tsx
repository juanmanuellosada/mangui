"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

function ChartCardSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      <Skeleton className={`h-4 ${titleWidth}`} />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

const MoneyFlowSankey = dynamic(
  () => import("@/components/dashboard/money-flow-sankey").then((m) => m.MoneyFlowSankey),
  { ssr: false, loading: () => <ChartCardSkeleton titleWidth="w-28" /> }
)

const CategoryPieChart = dynamic(
  () => import("@/components/dashboard/category-pie-chart").then((m) => m.CategoryPieChart),
  { ssr: false, loading: () => <ChartCardSkeleton titleWidth="w-36" /> }
)

const IncomeExpenseChart = dynamic(
  () => import("@/components/dashboard/income-expense-chart").then((m) => m.IncomeExpenseChart),
  { ssr: false, loading: () => <ChartCardSkeleton titleWidth="w-36" /> }
)

export function DashboardCharts() {
  return (
    <>
      <MoneyFlowSankey />
      <div className="grid md:grid-cols-2 gap-4 [&>*]:min-w-0">
        <CategoryPieChart />
        <IncomeExpenseChart />
      </div>
    </>
  )
}
