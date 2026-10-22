import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/database.types"

/** Lectura exclusiva de presupuestos, sin compartir caché con listas truncadas. */
export async function fetchBudgetMovements(
  supabase: SupabaseClient<Database>,
  userId?: string
): Promise<Tables<"movements">[]> {
  const rows: Tables<"movements">[] = []
  const pageSize = 200
  for (;;) {
    let query = supabase.from("movements").select("*", { count: "exact" }).order("id", { ascending: true })
    if (userId) query = query.eq("user_id", userId)
    const { data, error, count } = await query.range(rows.length, rows.length + pageSize - 1)
    if (error) throw error
    if (count === null || !data || (data.length === 0 && rows.length < count)) {
      throw new Error("No se pudo leer el período completo del presupuesto")
    }
    rows.push(...data)
    if (rows.length >= count) return rows
  }
}
