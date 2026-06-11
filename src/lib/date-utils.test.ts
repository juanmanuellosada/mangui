import { describe, it, expect } from "vitest"
import { todayAR } from "./date-utils"

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

describe("todayAR", () => {
  it("returns a string in yyyy-MM-dd format", () => {
    expect(todayAR()).toMatch(ISO_DATE_RE)
  })
})
