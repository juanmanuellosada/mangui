import { describe, it, expect } from "vitest"
import { detectUnusualCharge, type UnusualChargeMovement } from "./unusual"

function makeMovement(overrides: Partial<UnusualChargeMovement>): UnusualChargeMovement {
  return {
    id: "mov-1",
    type: "expense",
    is_future: false,
    date: "2026-03-01",
    category_id: "cat-1",
    amount: 1000,
    converted_amount: null,
    original_currency: "ARS",
    ...overrides,
  }
}

function makeHistory(count: number, amount: number, overrides?: Partial<UnusualChargeMovement>): UnusualChargeMovement[] {
  return Array.from({ length: count }, (_, i) =>
    makeMovement({
      id: `hist-${i}`,
      date: `2026-02-0${(i % 9) + 1}`,
      amount,
      ...overrides,
    })
  )
}

describe("detectUnusualCharge", () => {
  it("flags a clearly unusual charge (>3x the historical average)", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 10000 })
    const historical = makeHistory(5, 2000)
    const result = detectUnusualCharge(candidate, historical)
    expect(result).not.toBeNull()
    expect(result!.avg).toBe(2000)
    expect(result!.ratio).toBe(5)
    expect(result!.isUnusual).toBe(true)
  })

  it("does not flag a charge under 3x the average", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 4000 })
    const historical = makeHistory(5, 2000)
    const result = detectUnusualCharge(candidate, historical)
    expect(result).not.toBeNull()
    expect(result!.ratio).toBe(2)
    expect(result!.isUnusual).toBe(false)
  })

  it("returns null when there isn't enough history (< MIN_HISTORY)", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 10000 })
    const historical = makeHistory(4, 2000)
    expect(detectUnusualCharge(candidate, historical)).toBeNull()
  })

  it("returns null when the candidate has no category", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 10000, category_id: null })
    const historical = makeHistory(5, 2000)
    expect(detectUnusualCharge(candidate, historical)).toBeNull()
  })

  it("does not flag a charge below the MIN_AMOUNT floor even if it's >3x the average", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 350 })
    const historical = makeHistory(5, 100)
    const result = detectUnusualCharge(candidate, historical)
    expect(result).not.toBeNull()
    expect(result!.ratio).toBeCloseTo(3.5)
    expect(result!.isUnusual).toBe(false)
  })

  it("prefers converted_amount over amount for cross-currency movements (USD with ARS equivalent)", () => {
    const candidate = makeMovement({
      id: "candidate",
      date: "2026-04-01",
      amount: 1000, // native USD amount, should be ignored in favor of converted_amount
      converted_amount: 48000,
      original_currency: "USD",
    })
    const historical = makeHistory(5, 1000, { converted_amount: 8000, original_currency: "USD" })
    const result = detectUnusualCharge(candidate, historical)
    expect(result).not.toBeNull()
    expect(result!.avg).toBe(8000)
    expect(result!.ratio).toBe(6)
    expect(result!.isUnusual).toBe(true)
  })

  it("does not count a USD charge with no converted_amount ('USD puro') toward the ARS average or candidate", () => {
    // Historical: mostly ARS, plus one USD-puro (converted_amount null) that must be excluded (counts as 0).
    const historical = [
      ...makeHistory(5, 2000),
      makeMovement({ id: "usd-puro", date: "2026-02-05", amount: 999999, converted_amount: null, original_currency: "USD" }),
    ]
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 10000 })
    const result = detectUnusualCharge(candidate, historical)
    expect(result).not.toBeNull()
    // avg over 6 history rows: (2000*5 + 0) / 6, not skewed by the USD-puro amount
    expect(result!.avg).toBeCloseTo((2000 * 5) / 6)
  })

  it("returns null for non-expense movements", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 10000, type: "income" })
    const historical = makeHistory(5, 2000)
    expect(detectUnusualCharge(candidate, historical)).toBeNull()
  })

  it("returns null for future movements", () => {
    const candidate = makeMovement({ id: "candidate", date: "2026-04-01", amount: 10000, is_future: true })
    const historical = makeHistory(5, 2000)
    expect(detectUnusualCharge(candidate, historical)).toBeNull()
  })
})
