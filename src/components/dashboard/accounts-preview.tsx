"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { CurrencyChip } from "@/components/ui/currency-chip"
import { createClient } from "@/lib/supabase/client"
import {
  renderAccountIcon,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountBalance,
} from "@/lib/accounts"
import { formatCurrency, cn } from "@/lib/utils"

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
  if (error) throw error
  return data
}

function AccountCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3 flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="space-y-1.5 items-end flex flex-col">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-2.5 w-8" />
      </div>
    </div>
  )
}

export function AccountsPreview() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  })

  const { data: balances, isLoading: loadingBalances } = useQuery({
    queryKey: ["account_balances"],
    queryFn: fetchBalances,
  })

  const isLoading = loadingAccounts || loadingBalances

  const balanceMap = new Map(
    (balances ?? []).map((b) => [b.account_id, b])
  )

  const visible = (accounts ?? []).filter((a) => !a.is_hidden)

  return (
    <section className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground">Cuentas</h2>
        <Link
          href="/app/cuentas"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Ver todas
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <AccountCardSkeleton />
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </>
        ) : (
          visible.map((account) => {
            const bal = balanceMap.get(account.id)
            const balance = bal?.current_balance ?? account.initial_balance
            const currency = account.currency ?? "ARS"
            const type = account.type

            return (
              <div
                key={account.id}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card px-3.5 py-3 flex items-center gap-3 hover:border-primary/20 hover:shadow-sm transition-all duration-150"
              >
                {/* Left color accent */}
                <span
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{ background: account.color ?? "#65a30d" }}
                />

                {/* Icon */}
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {renderAccountIcon(account.icon, {
                    size: "h-5 w-5",
                    className: "text-muted-foreground",
                    logoFill: true,
                  })}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{account.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {ACCOUNT_TYPE_LABELS[type]}
                    </span>
                    {type === "tarjeta_credito" &&
                      account.closing_day != null && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="whitespace-nowrap">
                            Cierre {account.closing_day}
                          </span>
                        </>
                      )}
                    {type === "tarjeta_credito" &&
                      account.due_day != null && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="whitespace-nowrap">
                            Vto {account.due_day}
                          </span>
                        </>
                      )}
                  </div>
                </div>

                {/* Balance */}
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      balance < 0 ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {formatCurrency(balance, currency)}
                  </p>
                  <div className="flex justify-end mt-0.5">
                    <CurrencyChip currency={currency} size="sm" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
