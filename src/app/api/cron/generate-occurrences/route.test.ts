import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/date-utils", () => ({ todayAR: vi.fn() }))
vi.mock("@/lib/recurring", () => ({
  advanceNextRun: vi.fn(() => new Date("2026-03-01T12:00:00.000Z")),
}))

import { createAdminClient } from "@/lib/supabase/admin"
import { todayAR } from "@/lib/date-utils"
import { GET } from "./route"

const URL = "https://mangui.com.ar/api/cron/generate-occurrences"

function dueRecurring(id: string) {
  return {
    id,
    user_id: "user-1",
    next_run: "2026-02-15",
    end_date: null,
  }
}

function createAdminMock(records: ReturnType<typeof dueRecurring>[]) {
  const due = new Map(records.map((record) => [record.id, record]))
  const lte = vi.fn()
  const upsert = vi.fn().mockResolvedValue({ error: null })

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "recurring_occurrences") {
        return { upsert }
      }

      if (table !== "recurring_transactions") {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select: () => {
          let cursor: string | undefined
          let limit = 0
          const query = {
            eq: vi.fn(() => query),
            lte: vi.fn((...args: unknown[]) => {
              lte(...args)
              return query
            }),
            not: vi.fn(() => query),
            order: vi.fn(() => query),
            gt: vi.fn((_column: string, value: string) => {
              cursor = value
              return query
            }),
            limit: vi.fn((size: number) => {
              limit = size
              return query
            }),
            range: vi.fn(async (from: number, to: number) => ({
              data: [...due.values()].slice(from, to + 1),
              error: null,
            })),
            then: (
              onfulfilled: (result: { data: ReturnType<typeof dueRecurring>[]; error: null }) => unknown,
              onrejected: (reason: unknown) => unknown
            ) =>
              Promise.resolve({
                data: [...due.values()]
                  .filter((record) => !cursor || record.id > cursor)
                  .slice(0, limit),
                error: null,
              }).then(onfulfilled, onrejected),
          }
          return query
        },
        update: vi.fn(() => ({
          eq: vi.fn(async (_column: string, id: string) => {
            due.delete(id)
            return { error: null }
          }),
        })),
      }
    }),
  }

  return { admin, lte, upsert }
}

describe("GET /api/cron/generate-occurrences", () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalSecret
    }
    vi.restoreAllMocks()
  })

  it("processes every due record across batches without mutable-offset skips", async () => {
    process.env.CRON_SECRET = "test-secret"
    vi.mocked(todayAR).mockReturnValue("2026-02-15")
    const { admin, lte, upsert } = createAdminMock(
      Array.from({ length: 100 }, (_, index) => dueRecurring(`rec-${String(index).padStart(3, "0")}`))
    )
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET(
      new NextRequest(URL, { headers: { authorization: "Bearer test-secret" } })
    )

    expect(await response.json()).toMatchObject({ ok: true, processed: 100 })
    expect(upsert).toHaveBeenCalledTimes(100)
    expect(lte).toHaveBeenCalledWith("next_run", "2026-02-15")
  })
})
