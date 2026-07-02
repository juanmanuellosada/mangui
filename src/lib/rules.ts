import type { Tables, Enums } from "@/lib/database.types"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutoRule = Tables<"auto_rules">
export type AutoRuleCondition = Tables<"auto_rule_conditions">
export type RuleMatch = Enums<"rule_match">
export type RuleField = Enums<"rule_field">
export type RuleOperator = Enums<"rule_operator">
export type Category = Tables<"categories">
export type Account = Tables<"accounts">

/** Shape of the movement draft used for rule evaluation */
export interface MovementDraft {
  note?: string
  amount?: number
  account_id?: string
  type: "income" | "expense"
}

/** A rule together with its resolved conditions */
export interface RuleWithConditions {
  rule: AutoRule
  conditions: AutoRuleCondition[]
}

/** A suggested rule from heuristic analysis */
export interface SuggestedRule {
  name: string
  keyword: string
  conditionField: RuleField
  conditionOperator: RuleOperator
  conditionValue: string
  actionCategoryId: string
  categoryName: string
  movementCount: number
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const RULES_KEY = ["auto_rules"] as const
export const RULE_CONDITIONS_KEY = ["auto_rule_conditions"] as const

// ── Operators per field ───────────────────────────────────────────────────────

export function operatorsForField(field: RuleField): RuleOperator[] {
  switch (field) {
    case "note":
      return ["contains", "starts_with", "ends_with", "equals"]
    case "amount":
      return ["equals", "gt", "lt", "between"]
    case "account":
      return ["equals"]
    case "type":
      return ["equals"]
  }
}

// ── Human-readable labels ─────────────────────────────────────────────────────

export const FIELD_LABELS: Record<RuleField, string> = {
  note: "Nota",
  amount: "Monto",
  account: "Cuenta",
  type: "Tipo",
}

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: "contiene",
  starts_with: "empieza con",
  ends_with: "termina con",
  equals: "es igual a",
  gt: "mayor que",
  lt: "menor que",
  between: "entre",
}

export const TYPE_VALUE_LABELS: Record<string, string> = {
  income: "Ingreso",
  expense: "Gasto",
}

// ── Condition evaluation ──────────────────────────────────────────────────────

/**
 * Evaluate a single condition against a movement draft.
 * Returns true if the condition matches.
 */
export function evaluateCondition(
  cond: AutoRuleCondition,
  draft: MovementDraft
): boolean {
  switch (cond.field) {
    case "note": {
      const haystack = (draft.note ?? "").trim().toLowerCase()
      const needle = (cond.value_text ?? "").trim().toLowerCase()
      if (!needle) return false
      switch (cond.operator) {
        case "contains":
          return haystack.includes(needle)
        case "starts_with":
          return haystack.startsWith(needle)
        case "ends_with":
          return haystack.endsWith(needle)
        case "equals":
          return haystack === needle
        default:
          return false
      }
    }
    case "amount": {
      const amount = draft.amount ?? 0
      switch (cond.operator) {
        case "equals":
          return cond.value_num !== null && amount === cond.value_num
        case "gt":
          return cond.value_num !== null && amount > cond.value_num
        case "lt":
          return cond.value_num !== null && amount < cond.value_num
        case "between":
          return (
            cond.value_num !== null &&
            cond.value_num2 !== null &&
            amount >= cond.value_num &&
            amount <= cond.value_num2
          )
        default:
          return false
      }
    }
    case "account": {
      return draft.account_id === cond.value_text
    }
    case "type": {
      return draft.type === cond.value_text
    }
    default:
      return false
  }
}

/**
 * Determines if a rule matches a draft movement.
 * A rule with zero conditions does NOT match.
 */
export function ruleMatches(
  rule: AutoRule,
  conditions: AutoRuleCondition[],
  draft: MovementDraft
): boolean {
  if (conditions.length === 0) return false
  if (rule.match === "all") {
    return conditions.every((c) => evaluateCondition(c, draft))
  }
  // "any"
  return conditions.some((c) => evaluateCondition(c, draft))
}

/**
 * Among active rules whose conditions match the draft, return the one with
 * the highest priority. Tie → use the first one (earliest created).
 * Returns null if no rule matches.
 */
export function findMatchingRule(
  rules: AutoRule[],
  condsByRule: Map<string, AutoRuleCondition[]>,
  draft: MovementDraft
): AutoRule | null {
  const activeRules = rules.filter((r) => r.is_active)
  const matching = activeRules.filter((r) => {
    const conds = condsByRule.get(r.id) ?? []
    return ruleMatches(r, conds, draft)
  })
  if (matching.length === 0) return null
  // Sort by priority descending, then by created_at ascending (earlier = wins tie)
  matching.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.created_at < b.created_at ? -1 : 1
  })
  return matching[0]
}

// ── Human-readable summaries ──────────────────────────────────────────────────

/**
 * Returns a readable es-AR description for one condition.
 * E.g.: "Si la nota contiene \"Netflix\""
 */
export function conditionSummary(
  cond: AutoRuleCondition,
  accounts?: Account[]
): string {
  const fieldLabel = FIELD_LABELS[cond.field]
  const opLabel = OPERATOR_LABELS[cond.operator]

  switch (cond.field) {
    case "note":
      return `La nota ${opLabel} "${cond.value_text ?? ""}"`
    case "amount": {
      if (cond.operator === "between") {
        return `El monto ${opLabel} ${cond.value_num ?? 0} y ${cond.value_num2 ?? 0}`
      }
      return `El monto ${opLabel} ${cond.value_num ?? 0}`
    }
    case "account": {
      const acct = accounts?.find((a) => a.id === cond.value_text)
      const acctName = acct ? acct.name : cond.value_text ?? ""
      return `La cuenta ${opLabel} "${acctName}"`
    }
    case "type": {
      const typeLabel = TYPE_VALUE_LABELS[cond.value_text ?? ""] ?? cond.value_text ?? ""
      return `El tipo ${opLabel} "${typeLabel}"`
    }
    default:
      return `${fieldLabel} ${opLabel}`
  }
}

/**
 * Returns a full readable summary of a rule and its conditions.
 * E.g.: "Si la nota contiene \"Netflix\" → Categoría: Suscripciones"
 */
export function ruleSummary(
  rule: AutoRule,
  conditions: AutoRuleCondition[],
  refs: { categories?: Category[]; accounts?: Account[] }
): string {
  const sortedConds = [...conditions].sort((a, b) => a.position - b.position)

  const condParts = sortedConds.map((c) =>
    conditionSummary(c, refs.accounts)
  )

  const matchLabel = rule.match === "all" ? "todas" : "alguna"
  const condStr =
    condParts.length === 1
      ? `Si ${condParts[0].charAt(0).toLowerCase()}${condParts[0].slice(1)}`
      : `Si ${matchLabel} se cumplen: ${condParts.join("; ")}`

  const actions: string[] = []
  if (rule.action_category_id) {
    const cat = refs.categories?.find((c) => c.id === rule.action_category_id)
    actions.push(`Categoría: ${cat?.name ?? "–"}`)
  }
  if (rule.action_account_id) {
    const acct = refs.accounts?.find((a) => a.id === rule.action_account_id)
    actions.push(`Cuenta: ${acct?.name ?? "–"}`)
  }

  const actionStr = actions.length > 0 ? ` → ${actions.join(", ")}` : ""
  return condStr + actionStr
}

// ── Heuristic rule suggestions ────────────────────────────────────────────────

type Movement = {
  note: string | null
  category_id: string | null
  type: string
}

/**
 * Normalize a note for keyword extraction:
 * lowercase, strip numbers/symbols, collapse whitespace, trim.
 */
export function normalizeNote(note: string): string {
  return note
    .toLowerCase()
    .replace(/\d+([.,]\d+)*/g, " ") // strip numeric amounts
    .replace(/[$%#@!.,;:()\-_/\\]/g, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extract the best keyword from a normalized note.
 * For short notes (≤3 words), use the full note.
 * For longer notes, use the first word that's ≥3 chars.
 */
export function extractKeyword(normalized: string): string | null {
  const words = normalized.split(" ").filter((w) => w.length >= 3)
  if (words.length === 0) return null
  // Prefer the full note if short
  if (words.length <= 2) return words.join(" ")
  return words[0]
}

/**
 * Heuristic rule suggestions based on movement history.
 * For expense movements with a note and category:
 *   - Extract a keyword
 *   - Group movements by keyword
 *   - When ≥3 movements share a keyword and ≥80% map to the same category,
 *     suggest a rule
 *   - Skip keywords already covered by an existing rule
 * Returns up to 6 suggestions.
 */
export function suggestRules(
  movements: Movement[],
  categories: Category[],
  existingRules: AutoRule[]
): SuggestedRule[] {
  // Only consider expense movements with a note and category
  const eligible = movements.filter(
    (m) =>
      m.type === "expense" &&
      m.note &&
      m.note.trim().length > 0 &&
      m.category_id
  )

  // Build keyword → [{category_id, count}] map
  const kwMap = new Map<string, Map<string, number>>()

  for (const m of eligible) {
    const normalized = normalizeNote(m.note!)
    const kw = extractKeyword(normalized)
    if (!kw) continue

    if (!kwMap.has(kw)) kwMap.set(kw, new Map())
    const catMap = kwMap.get(kw)!
    catMap.set(m.category_id!, (catMap.get(m.category_id!) ?? 0) + 1)
  }

  // Existing rule keywords to skip (rules that do note contains)
  const existingKeywords = new Set<string>()
  for (const rule of existingRules) {
    // We don't have conditions here, but we can check rule names as a proxy
    existingKeywords.add(rule.name.toLowerCase())
  }

  const suggestions: SuggestedRule[] = []

  for (const [kw, catMap] of kwMap) {
    // Skip already-covered keywords (by name match)
    if (existingKeywords.has(kw.toLowerCase())) continue

    const total = Array.from(catMap.values()).reduce((a, b) => a + b, 0)
    if (total < 3) continue

    // Find dominant category
    let dominantCatId = ""
    let dominantCount = 0
    for (const [catId, count] of catMap) {
      if (count > dominantCount) {
        dominantCount = count
        dominantCatId = catId
      }
    }

    const dominance = dominantCount / total
    if (dominance < 0.8) continue

    const cat = categories.find((c) => c.id === dominantCatId)
    if (!cat) continue

    // Capitalize keyword for rule name
    const name = kw.charAt(0).toUpperCase() + kw.slice(1)

    suggestions.push({
      name,
      keyword: kw,
      conditionField: "note" as RuleField,
      conditionOperator: "contains" as RuleOperator,
      conditionValue: kw,
      actionCategoryId: dominantCatId,
      categoryName: cat.name,
      movementCount: total,
    })

    if (suggestions.length >= 6) break
  }

  return suggestions
}
