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
import { RecentMovements } from "@/components/dashboard/recent-movements"
import { AccountsPreview } from "@/components/dashboard/accounts-preview"
import { DashboardCharts } from "@/components/dashboard/dashboard-charts"
import { DashboardFiltersProvider, DashboardGlobalFilters } from "@/components/dashboard/dashboard-filters"
import { BudgetsSummary } from "@/components/dashboard/budgets-summary"
import { GoalsSummary } from "@/components/dashboard/goals-summary"
import { RendirNudge } from "@/components/dashboard/rendir-nudge"

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
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            Saldo total
          </p>
        </div>
      </div>

      {/* Balance hero — full width */}
      {hasAccounts && (
        <BalanceCards
          defaultCurrency={defaultCurrency}
          rateType={rateType}
          manualRate={manualRate}
          rates={rates}
        />
      )}

      {/* Onboarding CTA — shown only when user has no accounts */}
      {!hasAccounts && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 sm:p-8 text-center space-y-5 animate-scale-in">
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
            href="/cuentas"
            className={cn(
              buttonVariants({ size: "default" }),
              "gap-2 font-semibold shadow-sm shadow-primary/20 press-effect"
            )}
          >
            <Wallet className="h-4 w-4" />
            Agregar cuenta
          </Link>
        </div>
      )}

      {/* Accounts preview — visible only when there are accounts */}
      {hasAccounts && (
        <AccountsPreview
          rateType={rateType}
          manualRate={manualRate}
          rates={rates}
        />
      )}

      {/* Charts region — global filters + per-chart date filter */}
      {hasAccounts && (
        <DashboardFiltersProvider>
          <DashboardGlobalFilters />
          <DashboardCharts />
        </DashboardFiltersProvider>
      )}

      {/* Budgets summary widget */}
      {hasAccounts && <BudgetsSummary />}

      {/* Goals summary widget */}
      {hasAccounts && <GoalsSummary />}

      {/* Rendir nudge — shows only when idle ARS ≥ $100.000 */}
      {hasAccounts && <RendirNudge />}

      {/* Exchange rates strip */}
      <Suspense fallback={<Skeleton className="h-9 w-full rounded-xl" />}>
        <RatesStrip preferredRateType={rateType} />
      </Suspense>

      {/* Recent movements — full width */}
      <RecentMovements />
    </div>
  )
}
