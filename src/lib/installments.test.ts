import { describe, it, expect } from "vitest"
import {
  computeInstallmentAmounts,
  computeInstallmentDate,
  isInstallmentFuture,
} from "./installments"

// ---------------------------------------------------------------------------
// computeInstallmentAmounts
// ---------------------------------------------------------------------------
describe("computeInstallmentAmounts", () => {
  describe("sum invariant: (count-1)*perAmount + lastAmount === total", () => {
    const cases: [number, number][] = [
      [100, 3],
      [10, 3],
      [999.99, 7],
      [0.03, 2],
      [1_000_000, 12],
      [100, 1],
    ]

    it.each(cases)("total=%s count=%s sums back exactly", (total, count) => {
      const { perAmount, lastAmount } = computeInstallmentAmounts(total, count)
      const reconstructed = Math.round((perAmount * (count - 1) + lastAmount) * 100) / 100
      expect(reconstructed).toBe(total)
    })
  })

  it("100/3 → perAmount=33.33, lastAmount=33.34", () => {
    const { perAmount, lastAmount } = computeInstallmentAmounts(100, 3)
    expect(perAmount).toBe(33.33)
    expect(lastAmount).toBe(33.34)
  })

  it("10/3 → perAmount=3.33, lastAmount=3.34", () => {
    const { perAmount, lastAmount } = computeInstallmentAmounts(10, 3)
    expect(perAmount).toBe(3.33)
    expect(lastAmount).toBe(3.34)
  })

  it("999.99/7 → perAmount floored, sum preserved", () => {
    const { perAmount, lastAmount } = computeInstallmentAmounts(999.99, 7)
    // perAmount should be floored to 2 decimal places
    const raw = 999.99 / 7
    const floored = Math.floor(raw * 100) / 100
    expect(perAmount).toBe(floored)
    // last absorbs remainder
    const reconstructed = Math.round((perAmount * 6 + lastAmount) * 100) / 100
    expect(reconstructed).toBe(999.99)
  })

  it("0.03/2 → perAmount=0.01, lastAmount=0.02", () => {
    const { perAmount, lastAmount } = computeInstallmentAmounts(0.03, 2)
    expect(perAmount).toBe(0.01)
    expect(lastAmount).toBe(0.02)
  })

  it("count=1 → both values equal total", () => {
    const { perAmount, lastAmount } = computeInstallmentAmounts(250.5, 1)
    expect(perAmount).toBe(250.5)
    expect(lastAmount).toBe(250.5)
  })

  it("1000000/12 → perAmount floored to cents, sum correct", () => {
    const { perAmount, lastAmount } = computeInstallmentAmounts(1_000_000, 12)
    const reconstructed = Math.round((perAmount * 11 + lastAmount) * 100) / 100
    expect(reconstructed).toBe(1_000_000)
  })
})

// ---------------------------------------------------------------------------
// computeInstallmentDate
// ---------------------------------------------------------------------------
describe("computeInstallmentDate", () => {
  it("index=1 returns the start date unchanged", () => {
    expect(computeInstallmentDate("2026-01-31", 1)).toBe("2026-01-31")
  })

  it("index=2 adds 1 month, clamping to Feb 28 (2026 non-leap)", () => {
    expect(computeInstallmentDate("2026-01-31", 2)).toBe("2026-02-28")
  })

  it("index=3 adds 2 months from Jan 31 → Mar 31", () => {
    expect(computeInstallmentDate("2026-01-31", 3)).toBe("2026-03-31")
  })

  it("index=13 adds 12 months, same day next year", () => {
    expect(computeInstallmentDate("2026-01-15", 13)).toBe("2027-01-15")
  })

  it("mid-year base, no clamping needed", () => {
    // 2026-06-15 + 2 months = 2026-08-15
    expect(computeInstallmentDate("2026-06-15", 3)).toBe("2026-08-15")
  })

  it("year boundary: Dec → Jan", () => {
    expect(computeInstallmentDate("2026-12-01", 2)).toBe("2027-01-01")
  })
})

// ---------------------------------------------------------------------------
// isInstallmentFuture
// ---------------------------------------------------------------------------
describe("isInstallmentFuture", () => {
  it("returns false for a clearly past date (year 2000)", () => {
    expect(isInstallmentFuture("2000-01-01")).toBe(false)
  })

  it("returns true for a clearly future date (year 2099)", () => {
    expect(isInstallmentFuture("2099-12-31")).toBe(true)
  })

  it("returns false for today (not strictly after today)", () => {
    // today as yyyy-MM-dd
    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    expect(isInstallmentFuture(todayStr)).toBe(false)
  })
})
