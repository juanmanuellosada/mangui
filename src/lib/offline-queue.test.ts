import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach } from "vitest"
import { enqueueMovement, getQueuedMovements, removeQueued, countQueued, countQueuedForUser } from "./offline-queue"
import type { QueuedMovement } from "./offline-queue"

const DB_NAME = "mangui-offline"
const STORE = "mutations"
const USER_ID = "user-a"

// Inserts a record directly into the store with an explicit createdAt,
// bypassing the wall clock — used to deterministically test the FIFO sort
// in getQueuedMovements() without depending on Date.now() timing.
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
// Reset the queue before every test so state never leaks between tests.
// Note: openDB() in offline-queue.ts never closes its connections, so
// indexedDB.deleteDatabase() would hang waiting for those to close. Clearing
// via the module's own public API avoids that entirely.
// ---------------------------------------------------------------------------
beforeEach(async () => {
  const items = await getQueuedMovements()
  await Promise.all(items.map((i) => removeQueued(i.id)))
})

describe("getQueuedMovements", () => {
  it("returns an empty array when the queue is empty", async () => {
    await expect(getQueuedMovements()).resolves.toEqual([])
  })
})

describe("enqueueMovement", () => {
  it("adds an item with kind, id, createdAt, userId and the given payload", async () => {
    await enqueueMovement({ amount: 100, description: "coffee" }, USER_ID)

    const items = await getQueuedMovements()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: "movement",
      payload: { amount: 100, description: "coffee" },
      userId: USER_ID,
    })
    expect(typeof items[0].id).toBe("string")
    expect(items[0].id.length).toBeGreaterThan(0)
    expect(typeof items[0].createdAt).toBe("number")
  })

  it("appends multiple items to the queue", async () => {
    await enqueueMovement({ label: "one" }, USER_ID)
    await enqueueMovement({ label: "two" }, USER_ID)

    const items = await getQueuedMovements()
    expect(items).toHaveLength(2)
  })
})

describe("getQueuedMovements ordering", () => {
  it("returns items sorted by createdAt (FIFO), independent of id order", async () => {
    await insertRaw({ id: "id-c", kind: "movement", payload: { label: "third" }, createdAt: 300 })
    await insertRaw({ id: "id-a", kind: "movement", payload: { label: "first" }, createdAt: 100 })
    await insertRaw({ id: "id-b", kind: "movement", payload: { label: "second" }, createdAt: 200 })

    const items = await getQueuedMovements()
    expect(items.map((i) => i.payload.label)).toEqual(["first", "second", "third"])
  })
})

describe("removeQueued", () => {
  it("removes only the targeted item, leaving the rest", async () => {
    await enqueueMovement({ label: "keep-1" }, USER_ID)
    await enqueueMovement({ label: "remove-me" }, USER_ID)
    await enqueueMovement({ label: "keep-2" }, USER_ID)

    const before = await getQueuedMovements()
    const toRemove = before.find((i) => i.payload.label === "remove-me")!

    await removeQueued(toRemove.id)

    const after = await getQueuedMovements()
    expect(after).toHaveLength(2)
    expect(after.map((i) => i.payload.label).sort()).toEqual(["keep-1", "keep-2"])
  })

  it("resolves without error when removing a non-existent id", async () => {
    await expect(removeQueued("does-not-exist")).resolves.toBeUndefined()
  })
})

describe("countQueued", () => {
  it("returns 0 for an empty queue", async () => {
    await expect(countQueued()).resolves.toBe(0)
  })

  it("returns the number of queued items", async () => {
    await enqueueMovement({ label: "a" }, USER_ID)
    await enqueueMovement({ label: "b" }, USER_ID)
    await enqueueMovement({ label: "c" }, USER_ID)

    await expect(countQueued()).resolves.toBe(3)
  })

  it("reflects removals", async () => {
    await enqueueMovement({ label: "a" }, USER_ID)
    await enqueueMovement({ label: "b" }, USER_ID)
    const [first] = await getQueuedMovements()

    await removeQueued(first.id)

    await expect(countQueued()).resolves.toBe(1)
  })
})

describe("countQueuedForUser", () => {
  it("includes explicit same-user, legacy payload same-user, and ownerless legacy records only", async () => {
    await enqueueMovement({ label: "current" }, USER_ID)
    await insertRaw({
      id: "legacy-current",
      kind: "movement",
      payload: { label: "legacy-current", user_id: USER_ID },
      createdAt: 100,
    })
    await insertRaw({
      id: "legacy-ownerless",
      kind: "movement",
      payload: { label: "legacy-ownerless" },
      createdAt: 200,
    })
    await enqueueMovement({ label: "foreign" }, "user-other")
    await insertRaw({
      id: "legacy-foreign",
      kind: "movement",
      payload: { label: "legacy-foreign", user_id: "user-other" },
      createdAt: 300,
    })

    await expect(countQueuedForUser(USER_ID)).resolves.toBe(3)
  })
})

describe("SSR safety (indexedDB unavailable)", () => {
  it("no-ops instead of throwing when indexedDB is undefined", async () => {
    const original = globalThis.indexedDB
    // @ts-expect-error simulate an environment without IndexedDB (SSR)
    delete globalThis.indexedDB

    try {
      await expect(enqueueMovement({ label: "ssr" }, USER_ID)).resolves.toBeUndefined()
      await expect(getQueuedMovements()).resolves.toEqual([])
      await expect(removeQueued("whatever")).resolves.toBeUndefined()
      await expect(countQueued()).resolves.toBe(0)
    } finally {
      globalThis.indexedDB = original
    }
  })
})
