import type { Tables, Enums } from "@/lib/database.types"
import type { DateRangeValue } from "@/components/ui/date-range-filter"
import type { Account } from "@/lib/accounts"
import { createClient } from "@/lib/supabase/client"

export type Movement = Tables<"movements">
export type MovementType = Enums<"movement_type">
export type Currency = Enums<"currency">

/** dollar_type on movements includes 'tarjeta' in addition to the rate_type enum */
export type DollarType = "oficial" | "blue" | "mep" | "ccl" | "tarjeta"

export const DOLLAR_TYPE_LABELS: Record<DollarType, string> = {
  oficial: "Oficial",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
  tarjeta: "Tarjeta",
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  income: "Ingreso",
  expense: "Gasto",
}

/** Query keys for TanStack Query cache invalidation */
export const MOVEMENTS_KEY = ["movements"] as const
export const TRANSFERS_KEY = ["transfers"] as const
export const ACCOUNTS_KEY = ["accounts"] as const
export const BALANCES_KEY = ["account_balances"] as const
export const CATEGORIES_KEY = ["categories"] as const

// ── MovementsFilter ───────────────────────────────────────────────────────────

export type MovementsFilterType = "all" | "income" | "expense" | "transfer"

export interface MovementsFilter {
  search: string
  type: MovementsFilterType
  date: DateRangeValue
  accountIds: string[]
  categoryIds: string[]
}

// ── PostgREST `.or()` escaping ────────────────────────────────────────────────

/**
 * Escape a user-supplied string for use inside a PostgREST ilike pattern.
 * - `%` and `_` are ilike wildcards → escape them.
 * - `(`, `)`, `,` are structural in `.or()` strings → escape them too.
 * PostgREST accepts backslash-escaped % and _ in ilike.
 */
function escapeIlike(s: string): string {
  return s.replace(/[%_(),]/g, (c) => `\\${c}`)
}

type CategoryRow = { id: string; name: string }

// ── Server-side fetchers ──────────────────────────────────────────────────────

/**
 * fetchMovements — server-side filtered movements query.
 * Pass `accounts` and `categories` lists (already loaded) for search-by-name.
 */
export async function fetchMovements(
  filter: MovementsFilter,
  accounts: Account[],
  categories: CategoryRow[],
): Promise<Movement[]> {
  const supabase = createClient()

  // type='transfer' → movements query returns empty
  if (filter.type === "transfer") return []

  let q = supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200)

  // Date range
  if (filter.date.from) q = q.gte("date", filter.date.from)
  if (filter.date.to) q = q.lte("date", filter.date.to)

  // Type filter (income / expense)
  if (filter.type === "income" || filter.type === "expense") {
    q = q.eq("type", filter.type)
  }

  // Account filter
  if (filter.accountIds.length > 0) {
    q = q.in("account_id", filter.accountIds)
  }

  // Category filter
  if (filter.categoryIds.length > 0) {
    q = q.in("category_id", filter.categoryIds)
  }

  // Search: resolve matching account/category IDs by name, then build OR clause
  if (filter.search.trim()) {
    const term = filter.search.trim()
    const escaped = escapeIlike(term)

    const matchAccIds = accounts
      .filter((a) => a.name.toLowerCase().includes(term.toLowerCase()))
      .map((a) => a.id)

    const matchCatIds = categories
      .filter((c) => c.name.toLowerCase().includes(term.toLowerCase()))
      .map((c) => c.id)

    // tags.cs.{"term"} matches only an exact tag (PostgREST arrays don't support
    // ilike) — so tag search is exact while note search stays partial/ilike.
    const orParts: string[] = [`note.ilike.%${escaped}%`, `tags.cs.{"${escaped}"}`]
    if (matchAccIds.length > 0) {
      orParts.push(`account_id.in.(${matchAccIds.join(",")})`)
    }
    if (matchCatIds.length > 0) {
      orParts.push(`category_id.in.(${matchCatIds.join(",")})`)
    }
    q = q.or(orParts.join(","))
  }

  const { data, error } = await q
  if (error) throw error
  return data
}

/**
 * fetchTransfers — server-side filtered transfers query.
 * Returns empty when type is income/expense, or when categoryIds is non-empty.
 */
export async function fetchTransfers(
  filter: MovementsFilter,
  accounts: Account[],
): Promise<Tables<"transfers">[]> {
  const supabase = createClient()

  // Transfers are excluded when filtering by income/expense type or by category
  if (filter.type === "income" || filter.type === "expense") return []
  if (filter.categoryIds.length > 0) return []

  let q = supabase
    .from("transfers")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200)

  // Date range
  if (filter.date.from) q = q.gte("date", filter.date.from)
  if (filter.date.to) q = q.lte("date", filter.date.to)

  // Account filter: match either from_account_id or to_account_id
  if (filter.accountIds.length > 0) {
    const ids = filter.accountIds.join(",")
    q = q.or(`from_account_id.in.(${ids}),to_account_id.in.(${ids})`)
  }

  // Search: note ilike + matching accounts by name
  if (filter.search.trim()) {
    const term = filter.search.trim()
    const escaped = escapeIlike(term)

    const matchAccIds = accounts
      .filter((a) => a.name.toLowerCase().includes(term.toLowerCase()))
      .map((a) => a.id)

    const orParts: string[] = [`note.ilike.%${escaped}%`]
    if (matchAccIds.length > 0) {
      orParts.push(
        `from_account_id.in.(${matchAccIds.join(",")})`,
        `to_account_id.in.(${matchAccIds.join(",")})`,
      )
    }
    q = q.or(orParts.join(","))
  }

  const { data, error } = await q
  if (error) throw error
  return data
}

/**
 * fetchAllMovements — fetches all movements without filtering (for client-side stats).
 * Use queryKey ["movements", "stats-all"] so the cache is shared across components.
 */
export async function fetchAllMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .limit(2000)
  if (error) throw error
  return data
}

/**
 * Serialize a MovementsFilter to a stable string for use in react-query keys.
 */
export function filterKey(filter: MovementsFilter): string {
  return JSON.stringify({
    s: filter.search,
    t: filter.type,
    df: filter.date.from,
    dt: filter.date.to,
    a: [...filter.accountIds].sort(),
    c: [...filter.categoryIds].sort(),
  })
}
