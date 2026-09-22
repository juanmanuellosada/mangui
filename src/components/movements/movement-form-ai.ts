import { resolveEntity } from "@/lib/entity-resolver"

/** Cap de cuentas mandadas al modelo en extract-movement (ver route.ts). */
export const AI_ACCOUNTS_CAP = 100

/**
 * Resuelve la cuenta de un resultado de IA con precedencia índice > puntaje
 * (Decisión 1 de mejorar-deteccion-cuenta-ia): valida `cuenta_idx` contra
 * `sentAccounts` (la misma lista, en el mismo orden, que se mandó al modelo,
 * ya capada); si está ausente o fuera de rango, cae al resolver por nombre
 * sobre `allAccounts` excluyendo cuentas ocultas. `priorBoost` (opcional) es
 * el término de aprendizaje del puntaje (ver account-learning.ts, capa 3) —
 * solo se aplica en el fallback por nombre, nunca cuando hay índice válido.
 */
export function resolveAiAccount<T extends { id: string; name: string; is_hidden: boolean }>(
  result: { cuenta_idx: number | null | undefined; cuenta: string | null },
  sentAccounts: readonly T[],
  allAccounts: readonly T[],
  priorBoost?: (candidate: T) => number
): T | null {
  const idx = result.cuenta_idx
  if (idx != null && Number.isInteger(idx) && idx >= 0 && idx < sentAccounts.length) {
    return sentAccounts[idx]
  }
  if (result.cuenta) {
    const byName = resolveEntity(result.cuenta, allAccounts, { isHidden: (a) => a.is_hidden, priorBoost })
    if (byName.resolved) return allAccounts.find((a) => a.id === byName.id) ?? null
  }
  return null
}
