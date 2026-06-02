"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Briefcase } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, cn } from "@/lib/utils"
import type { AccountBalance, AccountType } from "@/lib/accounts"
import { ACCOUNT_TYPE_ICON_COMPONENTS } from "@/lib/accounts"

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
    .eq("is_hidden", false)
  if (error) throw error
  return data
}

function AccountIcon({ type }: { type: AccountType | null }) {
  const Icon = type ? (ACCOUNT_TYPE_ICON_COMPONENTS[type] ?? Briefcase) : Briefcase
  return <Icon className="h-4 w-4 text-muted-foreground" />
}

export function AccountSummary() {
  const { data: balances, isLoading } = useQuery({
    queryKey: ["account_balances"],
    queryFn: fetchBalances,
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-3"
          >
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!balances || balances.length === 0) return null

  return (
    <div className="space-y-1.5">
      {balances.map((b) => (
        <div
          key={b.account_id}
          className={cn(
            "rounded-xl border border-border/60 bg-card px-3 py-2.5 flex items-center gap-3",
            "hover:border-primary/20 transition-all duration-150"
          )}
        >
          {/* Icon */}
          <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <AccountIcon type={b.account_type as AccountType | null} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{b.account_name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {b.currency}
            </p>
          </div>

          {/* Balance */}
          <p
            className={cn(
              "text-xs font-semibold tabular-nums flex-shrink-0",
              (b.current_balance ?? 0) < 0 ? "text-destructive" : "text-foreground"
            )}
          >
            {formatCurrency(b.current_balance ?? 0, b.currency ?? "ARS")}
          </p>
        </div>
      ))}
      <Link
        href="/app/cuentas"
        className="flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver todas
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
