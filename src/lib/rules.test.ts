import { describe, expect, it } from "vitest"
import type { Tables } from "@/lib/database.types"
import { suggestRules } from "./rules"

type AutoRule = Tables<"auto_rules">
type AutoRuleCondition = Tables<"auto_rule_conditions">
type Category = Tables<"categories">

function makeRule(overrides: Partial<AutoRule> = {}): AutoRule {
  return {
    id: "rule-1",
    user_id: "user-1",
    name: "Existing rule",
    match: "all",
    action_category_id: null,
    action_account_id: null,
    priority: 10,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeCondition(
  overrides: Partial<AutoRuleCondition> = {}
): AutoRuleCondition {
  return {
    id: "condition-1",
    rule_id: "rule-1",
    user_id: "user-1",
    field: "note",
    operator: "contains",
    value_text: "Netflix",
    value_num: null,
    value_num2: null,
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

const categories: Category[] = [
  {
    id: "subscriptions",
    user_id: "user-1",
    name: "Suscripciones",
    type: "expense",
    icon: null,
    is_default: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "entertainment",
    user_id: "user-1",
    name: "Entretenimiento",
    type: "expense",
    icon: null,
    is_default: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

function netflixMovements() {
  return Array.from({ length: 3 }, () => ({
    note: "Netflix",
    category_id: "subscriptions",
    type: "expense",
  }))
}

describe("suggestRules", () => {
  it("suppresses a suggestion covered by an existing note condition", () => {
    const suggestions = suggestRules(
      netflixMovements(),
      categories,
      [makeRule({ name: "Streaming" })],
      [makeCondition()]
    )

    expect(suggestions).toEqual([])
  })

  it("uses rule names as a fallback when conditions are not provided", () => {
    const suggestions = suggestRules(
      netflixMovements(),
      categories,
      [makeRule({ name: "Netflix" })]
    )

    expect(suggestions).toEqual([])
  })

  it("suggests only the category with at least 80% of matching movements", () => {
    const movements = [
      ...Array.from({ length: 4 }, () => ({
        note: "Spotify Premium",
        category_id: "subscriptions",
        type: "expense",
      })),
      {
        note: "Spotify Premium",
        category_id: "entertainment",
        type: "expense",
      },
    ]

    expect(suggestRules(movements, categories, [], [])).toEqual([
      expect.objectContaining({
        keyword: "spotify premium",
        actionCategoryId: "subscriptions",
        movementCount: 5,
      }),
    ])
  })
})
