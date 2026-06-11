import { describe, it, expect } from "vitest"
import { ipcMap, availableMonths, latestMonth, adjustSalary } from "./sueldo"

describe("ipcMap", () => {
  it("creates a map keyed by yyyy-MM", () => {
    const map = ipcMap()
    expect(map["2016-12"]).toBe(100.0)
  })

  it("excludes entries with ipc <= 0", () => {
    const map = ipcMap([
      { period: "2020-01", ipc: 0 },
      { period: "2020-02", ipc: 200 },
    ])
    expect(map["2020-01"]).toBeUndefined()
    expect(map["2020-02"]).toBe(200)
  })
})

describe("availableMonths", () => {
  it("returns months sorted ascending", () => {
    const months = availableMonths([
      { period: "2020-03", ipc: 300 },
      { period: "2020-01", ipc: 100 },
      { period: "2020-02", ipc: 200 },
    ])
    expect(months).toEqual(["2020-01", "2020-02", "2020-03"])
  })

  it("full dataset first month is 2016-12", () => {
    const months = availableMonths()
    expect(months[0]).toBe("2016-12")
  })
})

describe("latestMonth", () => {
  it("returns the last month in sorted order", () => {
    const latest = latestMonth([
      { period: "2020-03", ipc: 300 },
      { period: "2020-01", ipc: 100 },
    ])
    expect(latest).toBe("2020-03")
  })

  it("returns 2026-04 for the full dataset", () => {
    expect(latestMonth()).toBe("2026-04")
  })
})

describe("adjustSalary", () => {
  it("same fromMonth and refMonth gives factor=1, equivalente=amount, inflacion=0", () => {
    const r = adjustSalary(1000000, "2025-04", "2025-04")
    expect(r).not.toBeNull()
    expect(r!.factor).toBeCloseTo(1, 10)
    expect(r!.equivalente).toBeCloseTo(1000000, 5)
    expect(r!.inflacionAcumuladaPct).toBeCloseTo(0, 10)
    expect(r!.perdidaPoderPct).toBeCloseTo(0, 10)
  })

  it("2025-04 to 2026-04: factor≈1.3235, inflacion≈32.35%, perdida≈24.45%", () => {
    const r = adjustSalary(1000000, "2025-04", "2026-04")
    expect(r).not.toBeNull()
    // factor = 11363.0904 / 8585.6078 ≈ 1.3235
    expect(r!.factor).toBeCloseTo(1.3235, 2)
    // 1323504 actual — within 1000 of the rough estimate
    expect(Math.abs(r!.equivalente - 1323500)).toBeLessThan(1000)
    expect(r!.inflacionAcumuladaPct).toBeCloseTo(32.35, 1)
    expect(r!.perdidaPoderPct).toBeCloseTo(24.45, 1)
  })

  it("returns null for unknown fromMonth", () => {
    expect(adjustSalary(1000, "1900-01", "2026-04")).toBeNull()
  })

  it("returns null for unknown refMonth", () => {
    expect(adjustSalary(1000, "2025-04", "1900-01")).toBeNull()
  })
})
