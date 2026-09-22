import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/notifications", () => ({ sendPushToUser: vi.fn(), tryNotify: vi.fn() }))

import { argentinaHour, shouldProcessNotificationsAtHour } from "./route"

describe("shouldProcessNotificationsAtHour", () => {
  it("processes users within their one-hour notification window", () => {
    expect(shouldProcessNotificationsAtHour(9, 10)).toBe(true)
  })

  it("skips users outside their notification window", () => {
    expect(shouldProcessNotificationsAtHour(9, 11)).toBe(false)
  })

  it("treats midnight as a selected notification hour, not an all-hours sentinel", () => {
    expect(shouldProcessNotificationsAtHour(0, 0)).toBe(true)
    expect(shouldProcessNotificationsAtHour(23, 0)).toBe(true)
    expect(shouldProcessNotificationsAtHour(1, 0)).toBe(true)
    expect(shouldProcessNotificationsAtHour(22, 0)).toBe(false)
  })

  it("wraps the one-hour window around midnight", () => {
    expect(shouldProcessNotificationsAtHour(0, 23)).toBe(true)
    expect(shouldProcessNotificationsAtHour(23, 0)).toBe(true)
  })
})

describe("argentinaHour", () => {
  it("derives the local America/Argentina/Buenos_Aires hour rather than UTC", () => {
    expect(argentinaHour(new Date("2025-01-01T02:30:00.000Z"))).toBe(23)
    expect(argentinaHour(new Date("2025-01-01T03:00:00.000Z"))).toBe(0)
  })
})
