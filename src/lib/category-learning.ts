import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/database.types"
import { normalizeNote, extractKeyword } from "@/lib/rules"

export type CategoryLearning = Tables<"category_learning">
type Category = Tables<"categories">

/** Cantidad mínima de aciertos para un comercio antes de sugerir la categoría automáticamente. */
export const LEARN_MIN_HITS = 2

/** Query key para la cache de aprendizaje de categorías. */
export const LEARNING_KEY = ["category_learning"] as const

/**
 * Deriva la clave de "comercio" a partir de la nota de un movimiento, usando
 * la misma normalización/extracción de keyword que el motor de reglas
 * (rules.ts), para que "Netflix", "netflix sub" y "NETFLIX $500" mapeen a la
 * misma clave. Devuelve null si la nota no aporta señal suficiente.
 */
export function merchantKey(note: string | null): string | null {
  if (!note) return null
  const normalized = normalizeNote(note)
  return extractKeyword(normalized)
}

/**
 * Sugiere una categoría aprendida para un comercio + tipo de movimiento.
 * Función pura: filtra los learnings por merchantKey(note), descarta los que
 * apuntan a una categoría de otro type, y elige el de mayor hit_count
 * (desempate por last_used_at más reciente). Devuelve null si no hay señal
 * suficiente (sin key, sin learnings, o por debajo de LEARN_MIN_HITS).
 */
export function suggestLearnedCategory(
  learnings: CategoryLearning[],
  note: string | null,
  type: "income" | "expense",
  categories: Category[]
): string | null {
  const key = merchantKey(note)
  if (!key) return null

  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type]))

  const candidates = learnings.filter(
    (l) => l.merchant_key === key && categoryTypeById.get(l.category_id) === type
  )
  if (candidates.length === 0) return null

  const best = candidates.reduce((a, b) => {
    if (b.hit_count !== a.hit_count) return b.hit_count > a.hit_count ? b : a
    return b.last_used_at > a.last_used_at ? b : a
  })

  return best.hit_count >= LEARN_MIN_HITS ? best.category_id : null
}

/**
 * Registra (fire-and-forget) que el usuario asoció `note` con `categoryId`,
 * vía la RPC bump_category_learning. Nunca lanza — un fallo acá no debe
 * romper el guardado del movimiento.
 */
export async function recordCategoryLearning(
  supabase: SupabaseClient<Database>,
  note: string | null,
  categoryId: string | null
): Promise<void> {
  const key = merchantKey(note)
  if (!key || !categoryId) return
  try {
    await supabase.rpc("bump_category_learning", {
      p_merchant_key: key,
      p_category_id: categoryId,
    })
  } catch {
    // fire-and-forget: nunca debe romper el guardado del movimiento
  }
}

export async function fetchCategoryLearning(
  supabase: SupabaseClient<Database>
): Promise<CategoryLearning[]> {
  const { data, error } = await supabase.from("category_learning").select("*")
  if (error) throw error
  return data
}
