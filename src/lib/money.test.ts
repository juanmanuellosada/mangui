import { describe, it, expect } from "vitest"
import { amountInCurrency } from "./money"

describe("amountInCurrency", () => {
  it("returns amount when original_currency matches the target", () => {
    const m = { amount: 100, converted_amount: null, original_currency: "ARS" }
    expect(amountInCurrency(m, "ARS")).toBe(100)
  })

  it("returns amount when original_currency matches the target, ignoring a stray converted_amount", () => {
    const m = { amount: 100, converted_amount: 999, original_currency: "ARS" }
    expect(amountInCurrency(m, "ARS")).toBe(100)
  })

  it("returns converted_amount when currencies differ and converted_amount is present", () => {
    const m = { amount: 10, converted_amount: 13500, original_currency: "USD" }
    expect(amountInCurrency(m, "ARS")).toBe(13500)
  })

  it("returns 0 ('USD puro') when currencies differ and converted_amount is null", () => {
    const m = { amount: 10, converted_amount: null, original_currency: "USD" }
    expect(amountInCurrency(m, "ARS")).toBe(0)
  })
})
