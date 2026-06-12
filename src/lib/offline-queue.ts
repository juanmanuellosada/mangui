/**
 * offline-queue.ts — dependency-free IndexedDB write queue for offline movement creation.
 *
 * DB: "mangui-offline" v1, object store "mutations" (keyPath: "id").
 * SSR-safe: all functions are no-ops when indexedDB is unavailable.
 */

export type QueuedMovement = {
  id: string
  kind: "movement"
  payload: Record<string, unknown>
  createdAt: number
}

const DB_NAME = "mangui-offline"
const DB_VERSION = 1
const STORE = "mutations"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

function dispatchQueueChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent("mangui-queue-changed"))
  } catch {
    // ignore in environments where window events aren't available
  }
}

export async function enqueueMovement(payload: Record<string, unknown>): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDB()
  const item: QueuedMovement = {
    id: crypto.randomUUID(),
    kind: "movement",
    payload,
    createdAt: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const req = tx.objectStore(STORE).add(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  dispatchQueueChanged()
}

export async function getQueuedMovements(): Promise<QueuedMovement[]> {
  if (typeof indexedDB === "undefined") return []
  const db = await openDB()
  return new Promise<QueuedMovement[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const all = (req.result as QueuedMovement[]).sort((a, b) => a.createdAt - b.createdAt)
      resolve(all)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function removeQueued(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  dispatchQueueChanged()
}

export async function countQueued(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0
  const db = await openDB()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
