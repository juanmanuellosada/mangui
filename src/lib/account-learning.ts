import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/database.types"
import { merchantKey } from "@/lib/category-learning"

export type AccountLearning = Tables<"account_learning">

/** Cantidad mínima de repeticiones antes de que una asociación influya en el puntaje. */
export const ACCOUNT_LEARN_MIN_HITS = 2

/**
 * Boost máximo que el prior aprendido puede sumar al puntaje de un candidato
 * del resolver (ver openspec/changes/mejorar-deteccion-cuenta-ia/design.md,
 * decisión 3: "El prior aprendido es un término del puntaje, no una regla
 * aparte"). Nunca alcanza por sí solo el umbral de resolución.
 */
export const MAX_PRIOR_BOOST = 0.2

/** Repeticiones a partir de las cuales el boost satura en MAX_PRIOR_BOOST. */
const PRIOR_SATURATION_HITS = 5

/** Query key para la cache de aprendizaje de cuentas. */
export const ACCOUNT_LEARNING_KEY = ["account_learning"] as const

export interface AccountLearningContext {
  categoryId: string | null
  currency: string | null
  note: string | null
}

/** Claves de contexto (kind, key) relevantes para un movimiento dado. */
function contextKeys({ categoryId, currency, note }: AccountLearningContext): Array<{ kind: string; key: string }> {
  const keys: Array<{ kind: string; key: string }> = []
  if (categoryId && currency) {
    keys.push({ kind: "category_currency", key: `${categoryId}:${currency}` })
  }
  const mKey = merchantKey(note)
  if (mKey) keys.push({ kind: "merchant", key: mKey })
  return keys
}

/**
 * Mejor hit_count por cuenta candidata para el contexto dado, ya filtrado
 * por ACCOUNT_LEARN_MIN_HITS. Función pura, base de accountPriorBoost y de
 * suggestLearnedAccount.
 */
function bestHitsByAccount(learnings: AccountLearning[], context: AccountLearningContext): Map<string, number> {
  const hits = new Map<string, number>()
  for (const { kind, key } of contextKeys(context)) {
    for (const l of learnings) {
      if (l.context_kind !== kind || l.context_key !== key) continue
      if (l.hit_count < ACCOUNT_LEARN_MIN_HITS) continue
      const prev = hits.get(l.account_id) ?? 0
      if (l.hit_count > prev) hits.set(l.account_id, l.hit_count)
    }
  }
  return hits
}

/** Boost escalado por repeticiones, saturado en MAX_PRIOR_BOOST. */
export function priorBoostForHits(hitCount: number): number {
  if (hitCount < ACCOUNT_LEARN_MIN_HITS) return 0
  return MAX_PRIOR_BOOST * Math.min(1, hitCount / PRIOR_SATURATION_HITS)
}

/**
 * Punto de extensión `priorBoost` del resolver compartido (ver
 * entity-resolver.ts): suma hasta MAX_PRIOR_BOOST al puntaje del candidato
 * aprendido para el contexto, escalado por hit_count. Es un término más del
 * puntaje — nunca resuelve una cuenta por sí solo.
 */
export function accountPriorBoost(
  learnings: AccountLearning[],
  context: AccountLearningContext
): (candidate: { id: string }) => number {
  const hits = bestHitsByAccount(learnings, context)
  return (candidate) => {
    const hitCount = hits.get(candidate.id)
    return hitCount ? priorBoostForHits(hitCount) : 0
  }
}

/**
 * Cuenta aprendida más fuerte para el contexto, para usarse como sugerencia
 * descartable cuando no hay ningún hint de cuenta (design decisión 3, "caso
 * sin hint"). Nunca debe usarse para completar el campo en silencio.
 */
export function suggestLearnedAccount(
  learnings: AccountLearning[],
  context: AccountLearningContext
): string | null {
  let bestId: string | null = null
  let bestHits = -1
  for (const [accountId, hitCount] of bestHitsByAccount(learnings, context)) {
    if (hitCount > bestHits) {
      bestHits = hitCount
      bestId = accountId
    }
  }
  return bestId
}

/**
 * Registra (fire-and-forget) que el usuario confirmó `accountId` para el
 * contexto de categoría+moneda y/o comercio de `context.note`, vía la RPC
 * bump_account_learning. Nunca lanza — un fallo acá no debe romper el
 * guardado del movimiento.
 */
export async function recordAccountLearning(
  supabase: SupabaseClient<Database>,
  context: AccountLearningContext,
  accountId: string | null
): Promise<void> {
  if (!accountId) return
  const mKey = merchantKey(context.note)
  const hasCategoryContext = !!context.categoryId && !!context.currency
  if (!hasCategoryContext && !mKey) return
  try {
    await supabase.rpc("bump_account_learning", {
      // La función acepta NULL en estos tres params (ver 0058_account_learning.sql),
      // pero el generador de tipos de Supabase no refleja esa nullability para
      // args de RPC — cast necesario para no perder la semántica real.
      p_category_id: context.categoryId as string,
      p_currency: context.currency as string,
      p_merchant_key: mKey as string,
      p_account_id: accountId,
    })
  } catch {
    // fire-and-forget: nunca debe romper el guardado del movimiento
  }
}

export async function fetchAccountLearning(supabase: SupabaseClient<Database>): Promise<AccountLearning[]> {
  const { data, error } = await supabase.from("account_learning").select("*")
  if (error) throw error
  return data
}
