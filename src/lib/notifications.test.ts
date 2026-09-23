import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { tryNotify } from "./notifications"
import type { Database } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

type AdminClient = SupabaseClient<Database>

function createAdminMock({
  existing = false,
  insertError = null,
}: {
  existing?: boolean
  insertError?: { code?: string; message?: string } | null
} = {}) {
  const steps: string[] = []
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existing ? { id: "existing-log" } : null,
    error: null,
  })
  const eventKeyFilter = vi.fn(() => ({ maybeSingle }))
  const userIdFilter = vi.fn(() => ({ eq: eventKeyFilter }))
  const select = vi.fn(() => {
    steps.push("check")
    return { eq: userIdFilter }
  })
  const insert = vi.fn().mockImplementation(() => {
    steps.push("record")
    return Promise.resolve({ error: insertError })
  })
  const from = vi.fn(() => ({ select, insert }))

  return {
    admin: { from } as unknown as AdminClient,
    insert,
    steps,
  }
}

describe("tryNotify", () => {
  it("does not record an event when no push delivery succeeds", async () => {
    const { admin, insert } = createAdminMock()
    const send = vi.fn().mockResolvedValue(0)

    await expect(tryNotify(admin, "user-1", "event-1", send)).resolves.toBe(false)

    expect(send).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
  })

  it("checks existing event logs before attempting delivery", async () => {
    const { admin, insert } = createAdminMock({ existing: true })
    const send = vi.fn().mockResolvedValue(1)

    await expect(tryNotify(admin, "user-1", "event-1", send)).resolves.toBe(false)

    expect(send).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("records the event only after a successful delivery", async () => {
    const { admin, insert, steps } = createAdminMock()
    const send = vi.fn().mockImplementation(async () => {
      steps.push("send")
      return 1
    })

    await expect(tryNotify(admin, "user-1", "event-1", send)).resolves.toBe(true)

    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_key: "event-1",
      channel: "push",
    })
    expect(steps).toEqual(["check", "send", "record"])
  })

  it("does not record the event when delivery throws", async () => {
    const { admin, insert } = createAdminMock()
    const send = vi.fn().mockRejectedValue(new Error("VAPID unavailable"))

    await expect(tryNotify(admin, "user-1", "event-1", send)).resolves.toBe(false)

    expect(insert).not.toHaveBeenCalled()
  })
})
