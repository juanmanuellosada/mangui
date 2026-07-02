import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { enqueueMovement, getQueuedMovements, removeQueued } from "./offline-queue"
import type { QueuedMovement } from "./offline-queue"
import { drainQueue } from "./offline-sync"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

const DB_NAME = "mangui-offline"
const STORE = "mutations"

// ---------------------------------------------------------------------------
// Reset the queue before every test so state never leaks between tests.
// Note: openDB() in offline-queue.ts never closes its connections, so
// indexedDB.deleteDatabase() would hang waiting for those to close. Clearing
// via the module's own public API avoids that entirely.
// ---------------------------------------------------------------------------
beforeEach(async () => {
  const items = await getQueuedMovements()
  await Promise.all(items.map((i) => removeQueued(i.id)))
})

// Inserts a record directly into the store with an explicit createdAt,
// bypassing the wall clock — used to deterministically control the FIFO
// order that drainQueue processes items in.
function insertRaw(item: QueuedMovement): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

// ---------------------------------------------------------------------------
// Minimal Supabase client stub — only `.from().insert()` is exercised by
// drainQueue, so that's all we mock.
// ---------------------------------------------------------------------------
function makeSupabase(insertImpl: (payload: unknown) => Promise<{ error: { message: string } | null }>) {
  const from = vi.fn().mockReturnValue({
    insert: vi.fn().mockImplementation(insertImpl),
  })
  return { from } as unknown as SupabaseClient<Database>
}

describe("drainQueue", () => {
  it("returns synced: 0, failed: 0 for an empty queue without calling supabase", async () => {
    const supabase = makeSupabase(async () => ({ error: null }))

    const result = await drainQueue({ supabase })

    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("syncs every item, removes it from the queue, and calls onSynced", async () => {
    await enqueueMovement({ label: "a" })
    await enqueueMovement({ label: "b" })

    const supabase = makeSupabase(async () => ({ error: null }))
    const onSynced = vi.fn()

    const result = await drainQueue({ supabase, onSynced })

    expect(result).toEqual({ synced: 2, failed: 0 })
    expect(onSynced).toHaveBeenCalledTimes(2)
    await expect(getQueuedMovements()).resolves.toEqual([])
  })

  it("processes items in FIFO (createdAt) order", async () => {
    await insertRaw({ id: "id-c", kind: "movement", payload: { label: "third" }, createdAt: 300 })
    await insertRaw({ id: "id-a", kind: "movement", payload: { label: "first" }, createdAt: 100 })
    await insertRaw({ id: "id-b", kind: "movement", payload: { label: "second" }, createdAt: 200 })

    const seenOrder: unknown[] = []
    const supabase = makeSupabase(async (payload) => {
      seenOrder.push((payload as { label: string }).label)
      return { error: null }
    })

    await drainQueue({ supabase })

    expect(seenOrder).toEqual(["first", "second", "third"])
  })

  it("discards an item on a permanent (server-side) error and keeps draining", async () => {
    await enqueueMovement({ label: "bad" })
    await enqueueMovement({ label: "good" })

    const supabase = makeSupabase(async (payload) => {
      if ((payload as { label: string }).label === "bad") {
        return { error: { message: "row-level security violation" } }
      }
      return { error: null }
    })

    const result = await drainQueue({ supabase })

    expect(result).toEqual({ synced: 1, failed: 1 })
    await expect(getQueuedMovements()).resolves.toEqual([])
  })

  it("stops draining on a network error and keeps unprocessed items queued", async () => {
    await insertRaw({ id: "id-a", kind: "movement", payload: { label: "first" }, createdAt: 100 })
    await insertRaw({ id: "id-b", kind: "movement", payload: { label: "second" }, createdAt: 200 })
    await insertRaw({ id: "id-c", kind: "movement", payload: { label: "third" }, createdAt: 300 })

    const supabase = makeSupabase(async (payload) => {
      if ((payload as { label: string }).label === "second") {
        throw new Error("network down")
      }
      return { error: null }
    })
    const onSynced = vi.fn()

    const result = await drainQueue({ supabase, onSynced })

    // "first" synced and removed; "second" threw so draining stopped there;
    // "third" was never attempted and remains queued.
    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(onSynced).toHaveBeenCalledTimes(1)

    const remaining = await getQueuedMovements()
    expect(remaining.map((i) => i.payload.label)).toEqual(["second", "third"])
  })

  it("no-ops when indexedDB is unavailable (SSR)", async () => {
    const original = globalThis.indexedDB
    // @ts-expect-error simulate an environment without IndexedDB (SSR)
    delete globalThis.indexedDB

    try {
      const supabase = makeSupabase(async () => ({ error: null }))
      const result = await drainQueue({ supabase })

      expect(result).toEqual({ synced: 0, failed: 0 })
      expect(supabase.from).not.toHaveBeenCalled()
    } finally {
      globalThis.indexedDB = original
    }
  })
})
