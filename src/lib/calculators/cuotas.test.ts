import { describe, it, expect } from "vitest"
import { valorPresenteCuotas, cuotasVsContado, breakEvenInflation } from "./cuotas"

describe("valorPresenteCuotas", () => {
  it("with r=0 equals valorCuota * cuotas", () => {
    expect(valorPresenteCuotas(10000, 12, 0)).toBeCloseTo(120000, 5)
  })

  it("with r>0 and cuotas>=2 is strictly less than nominal and greater than valorCuota", () => {
    const vp = valorPresenteCuotas(10000, 12, 0.05)
    expect(vp).toBeLessThan(10000 * 12)
    expect(vp).toBeGreaterThan(10000)
  })

  it("with cuotas=1 equals valorCuota regardless of r", () => {
    expect(valorPresenteCuotas(10000, 1, 0.05)).toBeCloseTo(10000, 5)
    expect(valorPresenteCuotas(10000, 1, 0.3)).toBeCloseTo(10000, 5)
  })
})

describe("cuotasVsContado", () => {
  it("computes correct totals and VP for standard case", () => {
    const result = cuotasVsContado({
      contado: 100000,
      cuotas: 12,
      valorCuota: 10000,
      inflacionMensual: 0.05,
    })
    expect(result.totalNominal).toBe(120000)
    expect(result.recargoNominal).toBe(20000)
    expect(result.valorPresente).toBeLessThan(120000)
    expect(result.valorPresente).toBeGreaterThan(10000)
    expect(result.ahorroReal).toBeCloseTo(100000 - result.valorPresente, 5)
    expect(result.convieneCuotas).toBe(result.valorPresente < 100000)
  })

  it("when totalNominal <= contado, convieneCuotas is true and breakEvenInflacion is 0", () => {
    const result = cuotasVsContado({
      contado: 130000,
      cuotas: 12,
      valorCuota: 10000,
      inflacionMensual: 0.01,
    })
    // 12 * 10000 = 120000 < 130000
    expect(result.convieneCuotas).toBe(true)
    expect(result.breakEvenInflacion).toBe(0)
  })
})

describe("breakEvenInflation", () => {
  it("returns r* in (0,5) such that VP(cuotas, r*) ≈ contado", () => {
    const rStar = breakEvenInflation(100000, 12, 10000)
    expect(rStar).not.toBeNull()
    expect(rStar!).toBeGreaterThan(0)
    expect(rStar!).toBeLessThan(5)
    const vp = valorPresenteCuotas(10000, 12, rStar!)
    expect(vp).toBeCloseTo(100000, 0) // within 1 peso
  })

  it("returns null when valorCuota >= contado", () => {
    expect(breakEvenInflation(100000, 12, 100000)).toBeNull()
    expect(breakEvenInflation(100000, 12, 200000)).toBeNull()
  })
})
