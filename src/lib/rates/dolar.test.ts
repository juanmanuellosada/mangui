import { describe, it, expect } from "vitest"
import { getConversionRate, convertAmount } from "./dolar"
import type { RatesMap } from "./dolar"

// ── Fixture ────────────────────────────────────────────────────
const RATES: RatesMap = {
  blue: { buy: 1000, sell: 1050, fetchedAt: "2026-06-11T00:00:00Z" },
  oficial: { buy: 900, sell: 950, fetchedAt: "2026-06-11T00:00:00Z" },
}

// ── getConversionRate ──────────────────────────────────────────
describe("getConversionRate", () => {
  it("manual with a positive manualRate returns that rate", () => {
    expect(getConversionRate("manual", RATES, 1200, "ARS")).toBe(1200)
    expect(getConversionRate("manual", RATES, 1200, "USD")).toBe(1200)
  })

  it("manual with null manualRate returns null", () => {
    expect(getConversionRate("manual", RATES, null, "ARS")).toBeNull()
  })

  it("manual with 0 manualRate returns null", () => {
    expect(getConversionRate("manual", RATES, 0, "ARS")).toBeNull()
  })

  it("manual with negative manualRate returns null", () => {
    expect(getConversionRate("manual", RATES, -100, "USD")).toBeNull()
  })

  it("non-manual with present rate returns sell for ARS fromCurrency", () => {
    expect(getConversionRate("blue", RATES, null, "ARS")).toBe(1050)
  })

  it("non-manual with present rate returns buy for USD fromCurrency", () => {
    expect(getConversionRate("blue", RATES, null, "USD")).toBe(1000)
  })

  it("non-manual with rate type missing from map returns null", () => {
    expect(getConversionRate("mep", RATES, null, "ARS")).toBeNull()
    expect(getConversionRate("ccl", RATES, null, "USD")).toBeNull()
  })

  it("rate value 0 in map returns null", () => {
    const ratesWithZero: RatesMap = {
      blue: { buy: 0, sell: 0, fetchedAt: "2026-06-11T00:00:00Z" },
    }
    expect(getConversionRate("blue", ratesWithZero, null, "ARS")).toBeNull()
    expect(getConversionRate("blue", ratesWithZero, null, "USD")).toBeNull()
  })
})

// ── convertAmount ──────────────────────────────────────────────
describe("convertAmount", () => {
  it("same currency returns amount unchanged", async () => {
    expect(await convertAmount(500, "ARS", "ARS", "blue", null, RATES)).toBe(500)
    expect(await convertAmount(10, "USD", "USD", "blue", null, RATES)).toBe(10)
  })

  it("ARS → USD divides by sell rate", async () => {
    // sell = 1050
    const result = await convertAmount(2100, "ARS", "USD", "blue", null, RATES)
    expect(result).toBeCloseTo(2)
  })

  it("USD → ARS multiplies by buy rate", async () => {
    // buy = 1000
    const result = await convertAmount(3, "USD", "ARS", "blue", null, RATES)
    expect(result).toBeCloseTo(3000)
  })

  it("missing rate type returns null", async () => {
    expect(await convertAmount(100, "ARS", "USD", "mep", null, RATES)).toBeNull()
  })

  it("manual with null manualRate returns null", async () => {
    expect(await convertAmount(100, "ARS", "USD", "manual", null, RATES)).toBeNull()
  })

  it("manual with positive manualRate converts correctly", async () => {
    // ARS → USD with manual rate 1000: 2000 / 1000 = 2
    const result = await convertAmount(2000, "ARS", "USD", "manual", 1000, RATES)
    expect(result).toBeCloseTo(2)
  })

  it("manual with 0 manualRate returns null", async () => {
    expect(await convertAmount(100, "ARS", "USD", "manual", 0, RATES)).toBeNull()
  })
})
