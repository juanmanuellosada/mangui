import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/database.types"
import {
  ACCOUNT_LEARN_MIN_HITS,
  MAX_PRIOR_BOOST,
  accountPriorBoost,
  priorBoostForHits,
  recordAccountLearning,
  suggestLearnedAccount,
} from "./account-learning"
import { resolveEntity, MIN_SCORE } from "@/lib/entity-resolver"

type AccountLearning = Tables<"account_learning">

function makeLearning(overrides: Partial<AccountLearning>): AccountLearning {
  return {
    id: "learning-1",
    user_id: "user-1",
    context_kind: "category_currency",
    context_key: "cat-1:ARS",
    account_id: "acc-1",
    hit_count: ACCOUNT_LEARN_MIN_HITS,
    last_used_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// priorBoostForHits
// ---------------------------------------------------------------------------
describe("priorBoostForHits", () => {
  it("returns 0 below ACCOUNT_LEARN_MIN_HITS", () => {
    expect(priorBoostForHits(ACCOUNT_LEARN_MIN_HITS - 1)).toBe(0)
  })

  it("scales up with hit_count", () => {
    const low = priorBoostForHits(ACCOUNT_LEARN_MIN_HITS)
    const high = priorBoostForHits(ACCOUNT_LEARN_MIN_HITS + 2)
    expect(low).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(low)
  })

  it("saturates at MAX_PRIOR_BOOST and never exceeds it", () => {
    expect(priorBoostForHits(1000)).toBe(MAX_PRIOR_BOOST)
  })
})

// ---------------------------------------------------------------------------
// accountPriorBoost
// ---------------------------------------------------------------------------
describe("accountPriorBoost", () => {
  it("returns 0 for a candidate with no learning at all", () => {
    const boost = accountPriorBoost([], { categoryId: "cat-1", currency: "ARS", note: null })
    expect(boost({ id: "acc-1" })).toBe(0)
  })

  it("boosts the learned account for the category+currency context", () => {
    const learnings = [makeLearning({ account_id: "acc-1", hit_count: 10 })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    expect(boost({ id: "acc-1" })).toBe(MAX_PRIOR_BOOST)
    expect(boost({ id: "other" })).toBe(0)
  })

  it("boosts via the merchant context derived from the note", () => {
    const learnings = [
      makeLearning({ context_kind: "merchant", context_key: "netflix", account_id: "acc-2", hit_count: 10 }),
    ]
    const boost = accountPriorBoost(learnings, { categoryId: null, currency: null, note: "Netflix $500" })
    expect(boost({ id: "acc-2" })).toBe(MAX_PRIOR_BOOST)
  })

  it("does not influence below ACCOUNT_LEARN_MIN_HITS", () => {
    const learnings = [makeLearning({ account_id: "acc-1", hit_count: ACCOUNT_LEARN_MIN_HITS - 1 })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    expect(boost({ id: "acc-1" })).toBe(0)
  })

  it("ignores learnings for a different context_key", () => {
    const learnings = [makeLearning({ context_key: "cat-2:USD", account_id: "acc-1", hit_count: 10 })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    expect(boost({ id: "acc-1" })).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// suggestLearnedAccount
// ---------------------------------------------------------------------------
describe("suggestLearnedAccount", () => {
  it("suggests the strongest learned account for the context", () => {
    const learnings = [
      makeLearning({ account_id: "acc-1", hit_count: 3 }),
      makeLearning({ id: "l2", account_id: "acc-2", hit_count: 8 }),
    ]
    expect(suggestLearnedAccount(learnings, { categoryId: "cat-1", currency: "ARS", note: null })).toBe("acc-2")
  })

  it("returns null when nothing meets ACCOUNT_LEARN_MIN_HITS", () => {
    const learnings = [makeLearning({ account_id: "acc-1", hit_count: ACCOUNT_LEARN_MIN_HITS - 1 })]
    expect(suggestLearnedAccount(learnings, { categoryId: "cat-1", currency: "ARS", note: null })).toBeNull()
  })

  it("returns null when there is no context (no category+currency and no merchant key)", () => {
    const learnings = [makeLearning({ account_id: "acc-1", hit_count: 10 })]
    expect(suggestLearnedAccount(learnings, { categoryId: null, currency: null, note: null })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// recordAccountLearning
// ---------------------------------------------------------------------------
function makeSupabaseStub(rpcImpl: (...args: unknown[]) => unknown) {
  const rpc = vi.fn().mockImplementation(rpcImpl)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe("recordAccountLearning", () => {
  it("calls bump_account_learning with the category+currency and merchant keys", async () => {
    const { client, rpc } = makeSupabaseStub(() => ({ error: null }))
    await recordAccountLearning(client, { categoryId: "cat-1", currency: "ARS", note: "Netflix $500" }, "acc-1")
    expect(rpc).toHaveBeenCalledWith("bump_account_learning", {
      p_category_id: "cat-1",
      p_currency: "ARS",
      p_merchant_key: "netflix",
      p_account_id: "acc-1",
    })
  })

  it("does nothing when accountId is null", async () => {
    const { client, rpc } = makeSupabaseStub(() => ({ error: null }))
    await recordAccountLearning(client, { categoryId: "cat-1", currency: "ARS", note: null }, null)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("does nothing when there is no useful context", async () => {
    const { client, rpc } = makeSupabaseStub(() => ({ error: null }))
    await recordAccountLearning(client, { categoryId: null, currency: null, note: "hi" }, "acc-1")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("never throws when the RPC fails", async () => {
    const { client } = makeSupabaseStub(() => {
      throw new Error("network down")
    })
    await expect(
      recordAccountLearning(client, { categoryId: "cat-1", currency: "ARS", note: null }, "acc-1")
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Integración con el resolver (accountPriorBoost como priorBoost de
// resolveEntity) — los cuatro comportamientos no negociables del prior
// (ver design decisión 3 y openspec spec "Aprendizaje de cuenta a partir de
// movimientos confirmados").
// ---------------------------------------------------------------------------
describe("prior como término del puntaje del resolver (integración)", () => {
  const visa = { id: "visa", name: "Santander Río - Visa Signature" }
  const caja = { id: "caja", name: "Santander Río - Caja de ahorro" }
  const balanz = { id: "balanz", name: "Balanz - Comitente USD" }

  it("hint que no se parece a nada + prior máximo (0.20) sigue SIN resolver", () => {
    const learnings = [makeLearning({ account_id: balanz.id, hit_count: 1000 })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    expect(boost({ id: balanz.id })).toBe(MAX_PRIOR_BOOST)
    const result = resolveEntity("Santander Visa", [balanz], { priorBoost: boost })
    expect(result).toEqual({ resolved: false })
  })

  it("hint parcialmente parecido (~0.41) + prior → resuelve", () => {
    const learnings = [makeLearning({ account_id: caja.id, hit_count: ACCOUNT_LEARN_MIN_HITS })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    const result = resolveEntity("Santander Visa", [caja], { priorBoost: boost })
    expect(result).toEqual({ resolved: true, id: caja.id, score: expect.any(Number) })
    if (result.resolved) {
      expect(result.score).toBeGreaterThanOrEqual(MIN_SCORE)
    }
  })

  it("hint fuerte hacia otra cuenta (~0.85) le gana al prior sobre una que puntúa 0.41", () => {
    const learnings = [makeLearning({ account_id: caja.id, hit_count: 1000 })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    const result = resolveEntity("Santander Visa", [visa, caja], { priorBoost: boost })
    expect(result).toEqual({ resolved: true, id: visa.id, score: expect.any(Number) })
  })

  it("una asociación por debajo del mínimo de repeticiones no influye", () => {
    const learnings = [makeLearning({ account_id: caja.id, hit_count: ACCOUNT_LEARN_MIN_HITS - 1 })]
    const boost = accountPriorBoost(learnings, { categoryId: "cat-1", currency: "ARS", note: null })
    expect(boost({ id: caja.id })).toBe(0)
    const result = resolveEntity("Santander Visa", [caja], { priorBoost: boost })
    expect(result).toEqual({ resolved: false })
  })
})
