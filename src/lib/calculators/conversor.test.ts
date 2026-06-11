import { describe, it, expect } from "vitest"
import { convertDolar } from "./conversor"

describe("convertDolar", () => {
  const rate = { buy: 1430, sell: 1450 }

  it("ARS→USD: divides by sell", () => {
    expect(convertDolar(100000, "ars_to_usd", rate)).toBeCloseTo(100000 / 1450, 2)
  })

  it("USD→ARS: multiplies by buy", () => {
    expect(convertDolar(100, "usd_to_ars", rate)).toBeCloseTo(143000, 2)
  })

  it("amount 0 returns 0", () => {
    expect(convertDolar(0, "ars_to_usd", rate)).toBe(0)
  })

  it("negative amount returns 0", () => {
    expect(convertDolar(-500, "ars_to_usd", rate)).toBe(0)
  })

  it("NaN amount returns 0", () => {
    expect(convertDolar(NaN, "ars_to_usd", rate)).toBe(0)
  })

  it("rate sell=0 on ars_to_usd returns 0", () => {
    expect(convertDolar(100000, "ars_to_usd", { buy: 1430, sell: 0 })).toBe(0)
  })

  it("rate buy=0 on usd_to_ars returns 0", () => {
    expect(convertDolar(100, "usd_to_ars", { buy: 0, sell: 1450 })).toBe(0)
  })
})
