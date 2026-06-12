"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { TrendingUp, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import type { AccountBalance } from "@/lib/accounts"

const LIQUID_TYPES = new Set<string>([
  "caja_ahorro",
  "cuenta_corriente",
  "efectivo",
  "billetera_virtual",
  "otro",
])

const NUDGE_THRESHOLD = 100_000

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("account_balances").select("*")
  if (error) throw error
  return data
}

/**
 * Shows a subtle banner on the dashboard when the user has ≥$100.000 idle ARS,
 * linking them to /rendir.
 */
export function RendirNudge() {
  const { data: balances } = useQuery({
    queryKey: ["account_balances"],
    queryFn: fetchBalances,
  })

  if (!balances) return null

  const idleArs = balances
    .filter(
      (b) =>
        !b.is_hidden &&
        b.currency === "ARS" &&
        b.account_type != null &&
        LIQUID_TYPES.has(b.account_type),
    )
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  if (idleArs < NUDGE_THRESHOLD) return null

  return (
    <Link
      href="/rendir"
      className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors p-4 group"
    >
      <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
        <TrendingUp className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          Tenés ~{formatCurrency(idleArs, "ARS")} en pesos quietos
        </p>
        <p className="text-xs text-muted-foreground">
          Mirá dónde podrían rendir
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </Link>
  )
}
