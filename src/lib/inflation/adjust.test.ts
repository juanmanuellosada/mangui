import { describe, it, expect } from "vitest"
import { buildIpcMap, latestIpcMonth, inflationFactor, adjustAmount } from "./adjust"

const SAMPLE_IPC = {
  "2025-04": 8585.6078,
  "2026-04": 11363.0904,
}

describe("buildIpcMap", () => {
  it("maps rows to yyyy-MM keys", () => {
    const result = buildIpcMap([
      { period: "2026-04-01", ipc: 11363.0904 },
      { period: "2025-04-01", ipc: 8585.6078 },
    ])
    expect(result["2026-04"]).toBe(11363.0904)
    expect(result["2025-04"]).toBe(8585.6078)
  })

  it("skips rows with non-positive ipc", () => {
    const result = buildIpcMap([
      { period: "2026-04-01", ipc: 0 },
      { period: "2026-05-01", ipc: -100 },
      { period: "2026-06-01", ipc: 9000 },
    ])
    expect(Object.keys(result)).toEqual(["2026-06"])
  })

  it("skips rows with non-number ipc", () => {
    const result = buildIpcMap([
      { period: "2026-04-01", ipc: NaN },
      { period: "2026-05-01", ipc: 5000 },
    ])
    expect(Object.keys(result)).toEqual(["2026-05"])
  })

  it("uses only the first 7 chars of period as key", () => {
    const result = buildIpcMap([{ period: "2026-04-01", ipc: 1000 }])
    expect(result["2026-04"]).toBe(1000)
    expect(result["2026-04-01"]).toBeUndefined()
  })
})

describe("latestIpcMonth", () => {
  it("returns the lexicographically latest key", () => {
    expect(latestIpcMonth({ "2025-04": 100, "2026-04": 200, "2025-12": 150 })).toBe("2026-04")
  })

  it("returns null for an empty map", () => {
    expect(latestIpcMonth({})).toBeNull()
  })
})

describe("inflationFactor", () => {
  it("computes ipc_ref / ipc_from correctly", () => {
    const factor = inflationFactor("2025-04", "2026-04", SAMPLE_IPC)
    expect(factor).toBeCloseTo(1.3235, 3)
  })

  it("returns 1 when fromMonth is missing", () => {
    expect(inflationFactor("2024-01", "2026-04", SAMPLE_IPC)).toBe(1)
  })

  it("returns 1 when refMonth is missing", () => {
    expect(inflationFactor("2025-04", "2099-01", SAMPLE_IPC)).toBe(1)
  })

  it("returns 1 for same month (identity)", () => {
    expect(inflationFactor("2026-04", "2026-04", SAMPLE_IPC)).toBeCloseTo(1, 5)
  })
})

describe("adjustAmount", () => {
  it("adjusts amount from a dated movement to ref month", () => {
    const result = adjustAmount(1000, "2025-04-15", "2026-04", SAMPLE_IPC)
    expect(result).toBeCloseTo(1323.5, 0)
  })

  it("leaves amount unchanged when movement month has no IPC data", () => {
    const result = adjustAmount(500, "2020-01-10", "2026-04", SAMPLE_IPC)
    expect(result).toBe(500)
  })

  it("leaves amount unchanged when refMonth has no IPC data", () => {
    const result = adjustAmount(500, "2025-04-15", "2099-01", SAMPLE_IPC)
    expect(result).toBe(500)
  })
})
