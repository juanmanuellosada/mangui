"use client"

import { useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import { AccountIconChip } from "@/lib/accounts"
import { amountInCurrency } from "@/lib/money"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">
type Account = Tables<"accounts">

interface ExpenseByAccountProps {
  movements: Movement[]
  accounts: Account[]
  currency: "ARS" | "USD"
}

function effectiveAmount(m: Movement, currency: "ARS" | "USD"): number {
  return amountInCurrency(m, currency)
}

export function ExpenseByAccount({ movements, accounts, currency }: ExpenseByAccountProps) {
  const accMap = new Map(accounts.map((a) => [a.id, a]))

  const rows = useMemo(() => {
    const totals = new Map<string, number>()
    for (const m of movements) {
      if (m.type !== "expense") continue
      const prev = totals.get(m.account_id) ?? 0
      totals.set(m.account_id, prev + effectiveAmount(m, currency))
    }
    const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0)
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([accountId, total]) => ({
        accountId,
        total,
        percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
        account: accMap.get(accountId),
      }))
  }, [movements, currency, accounts]) // eslint-disable-line react-hooks/exhaustive-deps

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-2">
        <h3 className="text-sm font-semibold">Gastos por cuenta</h3>
        <p className="text-xs text-muted-foreground py-4 text-center">Sin gastos para el período.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      <h3 className="text-sm font-semibold">Gastos por cuenta</h3>
      <div className="space-y-2.5">
        {rows.map(({ accountId, total, percent, account }) => (
          <div key={accountId} className="space-y-1">
            <div className="flex items-center gap-2">
              <AccountIconChip icon={account?.icon} />
              <span className="text-xs font-medium flex-1 truncate">
                {account?.name ?? accountId}
              </span>
              <span className="text-xs font-semibold tabular-nums text-destructive">
                {formatCurrency(total, currency)}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">
                {percent.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(percent)}
              aria-valuemax={100}
              aria-label={`${account?.name ?? accountId}: ${percent.toFixed(1)}%`}
            >
              <div
                className="h-full rounded-full bg-destructive/60 transition-all duration-300 motion-reduce:transition-none"
                style={{
                  width: `${percent}%`,
                  ...(account?.color ? { backgroundColor: account.color + "99" } : {}),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
