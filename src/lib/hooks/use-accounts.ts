"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ACCOUNTS_KEY } from "@/lib/movements"
import type { Account } from "@/lib/accounts"

export type AccountsOrderBy = "created_at" | "name"

async function fetchAccounts(orderBy: AccountsOrderBy): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order(orderBy)
  if (error) throw error
  return data
}

/**
 * useAccounts — hook compartido para la query canónica de cuentas.
 * `orderBy` preserva las variantes de orden que existían entre los distintos
 * call sites antes de la deduplicación (por defecto "created_at", el más usado).
 */
export function useAccounts(options?: { orderBy?: AccountsOrderBy }) {
  const orderBy = options?.orderBy ?? "created_at"
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: () => fetchAccounts(orderBy),
  })
}
