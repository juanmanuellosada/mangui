import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { fetchBudgetMovements } from "./budget-income"

function clientFor(rows: { id: string }[], failAt = -1, cap = 200) {
  const range = vi.fn(async (from: number, to: number) => ({
    data: from === failAt ? null : rows.slice(from, Math.min(to + 1, from + cap)),
    count: rows.length,
    error: from === failAt ? new Error("lectura incompleta") : null,
  }))
  const query = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), range }
  return { client: { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>, query }
}

describe("complete budget movement reads", () => {
  it("reads beyond 500 rows using stable pagination and retains the user scope", async () => {
    const rows = Array.from({ length: 601 }, (_, i) => ({ id: String(i) }))
    const { client, query } = clientFor(rows)
    expect(await fetchBudgetMovements(client, "user-1")).toEqual(rows)
    expect(query.range.mock.calls).toEqual([[0, 199], [200, 399], [400, 599], [600, 799]])
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true })
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("honors a server row cap below the requested page size without truncating", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i) }))
    const { client } = clientFor(rows, -1, 100)
    expect(await fetchBudgetMovements(client)).toHaveLength(501)
  })

  it("rejects a failed later page rather than returning a truncated income base", async () => {
    const { client } = clientFor(Array.from({ length: 201 }, (_, i) => ({ id: String(i) })), 200)
    await expect(fetchBudgetMovements(client)).rejects.toThrow("lectura incompleta")
  })
})
