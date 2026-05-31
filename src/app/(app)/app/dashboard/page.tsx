import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Wallet } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { RatesStrip } from "@/components/rates-strip"
import { BalanceCards } from "@/components/dashboard/balance-cards"
import { AccountSummary } from "@/components/dashboard/account-summary"
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart"
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart"
import { RecentMovements } from "@/components/dashboard/recent-movements"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ count }, prefsResult, rates] = await Promise.all([
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("user_preferences")
      .select("default_currency, rate_type, manual_rate")
      .eq("user_id", user!.id)
      .maybeSingle(),
    fetchDolarRates(),
  ])

  const hasAccounts = (count ?? 0) > 0
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "acá"

  const prefs = prefsResult.data
  const defaultCurrency = (prefs?.default_currency ?? "ARS") as "ARS" | "USD"
  const rateType = prefs?.rate_type ?? "blue"
  const manualRate = prefs?.manual_rate ?? null

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground font-medium">
            Hola, {firstName}
          </p>
          <h1
            className="text-2xl md:text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tus finanzas
          </h1>
        </div>
      </div>

      {/* Exchange rates strip */}
      <Suspense
        fallback={<Skeleton className="h-8 w-full rounded-xl" />}
      >
        <RatesStrip preferredRateType={rateType} />
      </Suspense>

      {/* Onboarding CTA — shown only when user has no accounts */}
      {!hasAccounts && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Creá tu primera cuenta
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Agregá una cuenta bancaria, billetera o efectivo para empezar a
              registrar tus movimientos.
            </p>
          </div>
          <Link
            href="/app/accounts"
            className={cn(buttonVariants({ size: "default" }), "gap-2 font-semibold shadow-sm shadow-primary/20 press-effect")}
          >
            <Wallet className="h-4 w-4" />
            Agregar cuenta
          </Link>
        </div>
      )}

      {/* Bento grid — accounts/balances + summary */}
      {hasAccounts && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Balance hero: spans 2 columns on md+ */}
          <div className="md:col-span-2 space-y-4">
            <BalanceCards
              defaultCurrency={defaultCurrency}
              rateType={rateType}
              manualRate={manualRate}
              rates={rates}
            />
          </div>

          {/* Account summary: 1 column on md+ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cuentas
              </p>
            </div>
            <AccountSummary />
          </div>
        </div>
      )}

      {/* Charts + recent movements */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent movements — spans full width on mobile, half on md+ */}
        <div className="md:col-span-2">
          <RecentMovements />
        </div>

        {/* Category donut */}
        <CategoryPieChart />

        {/* Income vs expenses bar */}
        <IncomeExpenseChart />
      </div>
    </div>
  )
}
