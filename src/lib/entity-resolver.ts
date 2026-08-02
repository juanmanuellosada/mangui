/**
 * Resolver compartido de "nombre aproximado" -> entidad, usado para cuentas
 * y categorías cuando el sistema recibe un texto libre (del modelo o del
 * usuario) en lugar de un id. Reemplaza los matchers de substring
 * duplicados en movement-form.tsx, ai-chat.tsx, lib/ai/tools.ts e
 * import-statement-flow.tsx (ver openspec/changes/mejorar-deteccion-cuenta-ia).
 */

/** Puntaje mínimo para considerar resuelta una entidad. */
export const MIN_SCORE = 0.45

/** Diferencia mínima entre el mejor puntaje y el segundo para no considerarlo ambiguo. */
export const MIN_MARGIN = 0.15

export interface EntityCandidate {
  id: string
  name: string
}

export type ResolveResult =
  | { resolved: true; id: string; score: number }
  | { resolved: false }

export interface ResolveOptions<T> {
  /** Devuelve true si el candidato debe excluirse (p. ej. cuenta oculta). */
  isHidden?: (candidate: T) => boolean
  /**
   * Punto de extensión para el prior aprendido (ver decisión 3 del design):
   * suma hasta +0.20 al puntaje base de un candidato dado, escalado por
   * repeticiones. No implementado en este módulo — el resolver solo deja el
   * lugar para que el llamador lo inyecte.
   */
  priorBoost?: (candidate: T) => number
}

/**
 * lowercase -> NFD -> quita diacríticos -> no-alfanumérico a espacio ->
 * colapsa espacios -> trim.
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Tokeniza por espacio, descartando tokens de menos de 2 caracteres. */
export function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length >= 2)
}

/**
 * Puntaje de `name` como candidato para el texto `hint`:
 * coverage = proporción de tokens del hint presentes en name (por prefijo);
 * specificity = proporción de tokens de name que fueron matcheados;
 * score = 0.7 * coverage + 0.3 * specificity, con atajo a 1 si los
 * normalizados son iguales.
 */
export function scoreName(hint: string, name: string): number {
  const normalizedHint = normalizeText(hint)
  if (normalizedHint && normalizedHint === normalizeText(name)) return 1

  const hintTokens = tokenize(hint)
  const nameTokens = tokenize(name)
  if (hintTokens.length === 0 || nameTokens.length === 0) return 0

  const matchedHintTokens = new Set<number>()
  const matchedNameTokens = new Set<number>()
  hintTokens.forEach((ht, hi) => {
    nameTokens.forEach((nt, ni) => {
      if (nt.startsWith(ht)) {
        matchedHintTokens.add(hi)
        matchedNameTokens.add(ni)
      }
    })
  })

  const coverage = matchedHintTokens.size / hintTokens.length
  const specificity = matchedNameTokens.size / nameTokens.length
  return 0.7 * coverage + 0.3 * specificity
}

/**
 * Resuelve `hint` contra `candidates` por puntaje de cobertura de tokens.
 * Excluye ocultos (si se pasa `isHidden`), exige `MIN_SCORE` y un margen de
 * `MIN_MARGIN` sobre el segundo mejor candidato. Distingue explícitamente
 * "resuelto" de "no resuelto" en vez de devolver un id ambiguo.
 */
export function resolveEntity<T extends EntityCandidate>(
  hint: string | null | undefined,
  candidates: readonly T[],
  options: ResolveOptions<T> = {}
): ResolveResult {
  if (!hint) return { resolved: false }

  const pool = options.isHidden ? candidates.filter((c) => !options.isHidden!(c)) : candidates
  if (pool.length === 0) return { resolved: false }

  const scored = pool
    .map((candidate) => {
      const base = scoreName(hint, candidate.name)
      const boost = options.priorBoost ? options.priorBoost(candidate) : 0
      return { candidate, score: Math.min(1, base + boost) }
    })
    .sort((a, b) => b.score - a.score)

  const [best, second] = scored
  if (!best || best.score < MIN_SCORE) return { resolved: false }
  if (second && best.score - second.score < MIN_MARGIN) return { resolved: false }

  return { resolved: true, id: best.candidate.id, score: best.score }
}
