import { describe, it, expect } from "vitest"
import { parseIpcSeries } from "./indec"

describe("parseIpcSeries", () => {
  it("parses a valid sample into IpcPoint[]", () => {
    const result = parseIpcSeries({
      data: [
        ["2026-03-01", 11077.0608],
        ["2026-04-01", 11363.0904],
      ],
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ period: "2026-03-01", ipc: 11077.0608 })
    expect(result[1]).toEqual({ period: "2026-04-01", ipc: 11363.0904 })
  })

  it("skips malformed rows and keeps only the valid one", () => {
    const result = parseIpcSeries({
      data: [
        ["2026-05-01", null],      // null value
        ["bad-date", 100],         // invalid date format
        ["2026-06-01", "x"],       // string value
        ["2026-07-01", -5],        // negative value
        ["2026-08-01", 9000],      // valid
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ period: "2026-08-01", ipc: 9000 })
  })

  it("returns [] for empty object", () => {
    expect(parseIpcSeries({})).toEqual([])
  })

  it("returns [] when data is a string", () => {
    expect(parseIpcSeries({ data: "nope" })).toEqual([])
  })

  it("returns [] for empty data array", () => {
    expect(parseIpcSeries({ data: [] })).toEqual([])
  })
})
