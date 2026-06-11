import { describe, it, expect } from "vitest"
import { calcularRegla } from "./regla"

describe("calcularRegla", () => {
  it("50/30/20 of 1_000_000 distributes correctly", () => {
    const result = calcularRegla({ ingreso: 1000000, pctNecesidades: 50, pctGustos: 30, pctAhorro: 20 })
    expect(result.necesidades).toBe(500000)
    expect(result.gustos).toBe(300000)
    expect(result.ahorro).toBe(200000)
    expect(result.sumaPct).toBe(100)
    expect(result.balanceado).toBe(true)
  })

  it("60/25/15 of 1_000_000 distributes correctly", () => {
    const result = calcularRegla({ ingreso: 1000000, pctNecesidades: 60, pctGustos: 25, pctAhorro: 15 })
    expect(result.necesidades).toBe(600000)
    expect(result.gustos).toBe(250000)
    expect(result.ahorro).toBe(150000)
    expect(result.sumaPct).toBe(100)
    expect(result.balanceado).toBe(true)
  })

  it("50/30/30 sums to 110 and is not balanceado", () => {
    const result = calcularRegla({ ingreso: 1000000, pctNecesidades: 50, pctGustos: 30, pctAhorro: 30 })
    expect(result.sumaPct).toBe(110)
    expect(result.balanceado).toBe(false)
  })

  it("ingreso 0 → all buckets are 0", () => {
    const result = calcularRegla({ ingreso: 0, pctNecesidades: 50, pctGustos: 30, pctAhorro: 20 })
    expect(result.necesidades).toBe(0)
    expect(result.gustos).toBe(0)
    expect(result.ahorro).toBe(0)
  })

  it("negative ingreso → all buckets are 0", () => {
    const result = calcularRegla({ ingreso: -500000, pctNecesidades: 50, pctGustos: 30, pctAhorro: 20 })
    expect(result.necesidades).toBe(0)
    expect(result.gustos).toBe(0)
    expect(result.ahorro).toBe(0)
  })

  it("NaN ingreso → all buckets are 0", () => {
    const result = calcularRegla({ ingreso: NaN, pctNecesidades: 50, pctGustos: 30, pctAhorro: 20 })
    expect(result.necesidades).toBe(0)
    expect(result.gustos).toBe(0)
    expect(result.ahorro).toBe(0)
  })
})
