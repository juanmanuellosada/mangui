import { describe, it, expect } from "vitest"
import type { Tables } from "@/lib/database.types"
import { merchantKey, suggestLearnedCategory, LEARN_MIN_HITS } from "./category-learning"

type CategoryLearning = Tables<"category_learning">
type Category = Tables<"categories">

function makeLearning(overrides: Partial<CategoryLearning>): CategoryLearning {
  return {
    id: "learning-1",
    user_id: "user-1",
    merchant_key: "netflix",
    category_id: "cat-1",
    hit_count: LEARN_MIN_HITS,
    last_used_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "cat-1",
    user_id: "user-1",
    name: "Suscripciones",
    type: "expense",
    icon: null,
    is_default: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// merchantKey
// ---------------------------------------------------------------------------
describe("merchantKey", () => {
  it("normalizes the note (lowercase, strips amounts/punctuation)", () => {
    expect(merchantKey("Netflix $500")).toBe("netflix")
    expect(merchantKey("NETFLIX")).toBe("netflix")
  })

  it("returns null for a null note", () => {
    expect(merchantKey(null)).toBeNull()
  })

  it("returns null for a note too short to be a signal", () => {
    expect(merchantKey("hi")).toBeNull()
    expect(merchantKey("  ")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// suggestLearnedCategory
// ---------------------------------------------------------------------------
describe("suggestLearnedCategory", () => {
  const categories = [
    makeCategory({ id: "cat-expense", type: "expense", name: "Suscripciones" }),
    makeCategory({ id: "cat-income", type: "income", name: "Sueldo" }),
  ]

  it("suggests the category when hit_count meets the threshold", () => {
    const learnings = [
      makeLearning({ merchant_key: "netflix", category_id: "cat-expense", hit_count: LEARN_MIN_HITS }),
    ]
    expect(suggestLearnedCategory(learnings, "Netflix", "expense", categories)).toBe("cat-expense")
  })

  it("returns null when below the LEARN_MIN_HITS threshold", () => {
    const learnings = [
      makeLearning({ merchant_key: "netflix", category_id: "cat-expense", hit_count: LEARN_MIN_HITS - 1 }),
    ]
    expect(suggestLearnedCategory(learnings, "Netflix", "expense", categories)).toBeNull()
  })

  it("filters out learnings whose category type doesn't match the movement type", () => {
    const learnings = [
      makeLearning({ merchant_key: "netflix", category_id: "cat-income", hit_count: 10 }),
    ]
    expect(suggestLearnedCategory(learnings, "Netflix", "expense", categories)).toBeNull()
  })

  it("returns null when the note yields no merchant key", () => {
    const learnings = [
      makeLearning({ merchant_key: "netflix", category_id: "cat-expense", hit_count: 10 }),
    ]
    expect(suggestLearnedCategory(learnings, null, "expense", categories)).toBeNull()
    expect(suggestLearnedCategory(learnings, "hi", "expense", categories)).toBeNull()
  })

  it("breaks ties between categories by highest hit_count", () => {
    const categories2 = [
      ...categories,
      makeCategory({ id: "cat-expense-2", type: "expense", name: "Entretenimiento" }),
    ]
    const learnings = [
      makeLearning({ id: "l1", merchant_key: "netflix", category_id: "cat-expense", hit_count: 3 }),
      makeLearning({ id: "l2", merchant_key: "netflix", category_id: "cat-expense-2", hit_count: 5 }),
    ]
    expect(suggestLearnedCategory(learnings, "Netflix", "expense", categories2)).toBe("cat-expense-2")
  })

  it("breaks ties on equal hit_count by most recent last_used_at", () => {
    const categories2 = [
      ...categories,
      makeCategory({ id: "cat-expense-2", type: "expense", name: "Entretenimiento" }),
    ]
    const learnings = [
      makeLearning({
        id: "l1",
        merchant_key: "netflix",
        category_id: "cat-expense",
        hit_count: 3,
        last_used_at: "2026-01-01T00:00:00Z",
      }),
      makeLearning({
        id: "l2",
        merchant_key: "netflix",
        category_id: "cat-expense-2",
        hit_count: 3,
        last_used_at: "2026-02-01T00:00:00Z",
      }),
    ]
    expect(suggestLearnedCategory(learnings, "Netflix", "expense", categories2)).toBe("cat-expense-2")
  })
})
