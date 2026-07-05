"use client"

import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"
import { renderCategoryIcon } from "@/lib/categories"
import { AccountIconChip } from "@/lib/accounts"
import { amountInCurrency } from "@/lib/money"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">

interface TopMovementsProps {
  movements: Movement[]
  categories: Category[]
  accounts: Account[]
  currency: "ARS" | "USD"
}

function effectiveAmount(m: Movement, currency: "ARS" | "USD"): number {
  return amountInCurrency(m, currency)
}

const TOP_N = 5

function MovRow({
  m,
  type,
  currency,
  catMap,
  accMap,
}: {
  m: Movement
  type: "expense" | "income"
  currency: "ARS" | "USD"
  catMap: Map<string, Category>
  accMap: Map<string, Account>
}) {
  const cat = m.category_id ? catMap.get(m.category_id) : undefined
  const acc = accMap.get(m.account_id)
  const amt = effectiveAmount(m, currency)
  const dateStr = format(parseISO(m.date + "T12:00:00"), "d MMM", { locale: es })

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="flex-shrink-0 text-base leading-none select-none">
        {renderCategoryIcon(cat?.icon, { className: "text-sm" })}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{cat?.name ?? "Sin categoría"}</p>
        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
          {acc && <AccountIconChip icon={acc.icon} />}
          <span className="truncate">{acc?.name}</span>
          <span className="flex-shrink-0">· {dateStr}</span>
        </p>
      </div>
      <p
        className={`text-xs font-bold tabular-nums flex-shrink-0 ${
          type === "expense" ? "text-destructive" : "text-success"
        }`}
      >
        {type === "expense" ? "−" : "+"}
        {formatCurrency(amt, currency)}
      </p>
    </div>
  )
}

function MovColumn({
  items,
  type,
  label,
  currency,
  catMap,
  accMap,
}: {
  items: Movement[]
  type: "expense" | "income"
  label: string
  currency: "ARS" | "USD"
  catMap: Map<string, Category>
  accMap: Map<string, Account>
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">—</p>
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((m) => (
            <MovRow key={m.id} m={m} type={type} currency={currency} catMap={catMap} accMap={accMap} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TopMovements({ movements, categories, accounts, currency }: TopMovementsProps) {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const accMap = new Map(accounts.map((a) => [a.id, a]))

  const expenses = movements
    .filter((m) => m.type === "expense")
    .sort((a, b) => effectiveAmount(b, currency) - effectiveAmount(a, currency))
    .slice(0, TOP_N)

  const incomes = movements
    .filter((m) => m.type === "income")
    .sort((a, b) => effectiveAmount(b, currency) - effectiveAmount(a, currency))
    .slice(0, TOP_N)

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold">Top movimientos del período</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <MovColumn items={expenses} type="expense" label="Mayores gastos" currency={currency} catMap={catMap} accMap={accMap} />
        <MovColumn items={incomes} type="income" label="Mayores ingresos" currency={currency} catMap={catMap} accMap={accMap} />
      </div>
    </div>
  )
}
