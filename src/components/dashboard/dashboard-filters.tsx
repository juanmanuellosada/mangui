"use client"

import { createContext, useContext, useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import type { Tables } from "@/lib/database.types"

type Account = Tables<"accounts">
type Category = Tables<"categories">

// ─── Context ──────────────────────────────────────────────────────────────────

interface DashboardFiltersValue {
  accountIds: string[]
  categoryIds: string[]
  setAccountIds: (v: string[]) => void
  setCategoryIds: (v: string[]) => void
}

const DashboardFiltersContext = createContext<DashboardFiltersValue | null>(null)

export function useDashboardFilters(): DashboardFiltersValue {
  const ctx = useContext(DashboardFiltersContext)
  if (!ctx) throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider")
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardFiltersProvider({ children }: { children: React.ReactNode }) {
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const value = useMemo(
    () => ({ accountIds, categoryIds, setAccountIds, setCategoryIds }),
    [accountIds, categoryIds],
  )

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  )
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("accounts").select("*").order("name")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*")
  if (error) throw error
  return data
}

// ─── Global filter bar ────────────────────────────────────────────────────────

export function DashboardGlobalFilters() {
  const { accountIds, setAccountIds, categoryIds, setCategoryIds } = useDashboardFilters()

  const { data: accounts } = useQuery({
    queryKey: ["accounts", "stats"],
    queryFn: fetchAccounts,
  })

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const accountOptions = useMemo(
    () =>
      (accounts ?? []).map((a) => ({
        value: a.id,
        label: a.name,
        leading: <AccountIconChip icon={a.icon} />,
      })),
    [accounts],
  )

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        leading: <CategoryIconChip icon={c.icon} />,
      })),
    [categories],
  )

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="w-full sm:flex-1 min-w-0">
        <MangoMultiSelect
          values={accountIds}
          onChange={setAccountIds}
          options={accountOptions}
          placeholder="Todas las cuentas"
          showSearch
        />
      </div>
      <div className="w-full sm:flex-1 min-w-0">
        <MangoMultiSelect
          values={categoryIds}
          onChange={setCategoryIds}
          options={categoryOptions}
          placeholder="Todas las categorías"
          showSearch
        />
      </div>
    </div>
  )
}
