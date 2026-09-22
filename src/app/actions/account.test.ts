import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/demo", () => ({ getIsDemo: vi.fn() }))
vi.mock("@/lib/mercadopago", () => ({ preApproval: { update: vi.fn() } }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

import { purgeStoragePrefix, type StorageBucket } from "./account"

function createBucket(
  list: StorageBucket["list"],
  remove: StorageBucket["remove"] = vi.fn().mockResolvedValue({ error: null })
): StorageBucket {
  return { list, remove }
}

describe("purgeStoragePrefix", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("removes objects nested under folder-like Storage entries", async () => {
    const list = vi.fn(async (path: string) => {
      switch (path) {
        case "user-1":
          return {
            data: [
              { id: "root-file", name: "avatar.png" },
              { id: null, name: "receipts" },
            ],
            error: null,
          }
        case "user-1/receipts":
          return {
            data: [
              { id: "receipt-file", name: "january.pdf" },
              { id: null, name: "archive" },
            ],
            error: null,
          }
        case "user-1/receipts/archive":
          return { data: [{ id: "archived-file", name: "2024.pdf" }], error: null }
        default:
          throw new Error(`Unexpected list path: ${path}`)
      }
    })
    const remove = vi.fn().mockResolvedValue({ error: null })

    await purgeStoragePrefix(createBucket(list, remove), "user-1", "attachments")

    expect(list).toHaveBeenCalledWith("user-1", { limit: 100, offset: 0 })
    expect(list).toHaveBeenCalledWith("user-1/receipts", { limit: 100, offset: 0 })
    expect(list).toHaveBeenCalledWith("user-1/receipts/archive", { limit: 100, offset: 0 })
    expect(remove).toHaveBeenCalledWith([
      "user-1/avatar.png",
      "user-1/receipts/january.pdf",
      "user-1/receipts/archive/2024.pdf",
    ])
  })

  it("logs list errors and still removes objects collected from other paths", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const list = vi.fn(async (path: string) => {
      if (path === "user-1") {
        return {
          data: [
            { id: "root-file", name: "avatar.png" },
            { id: null, name: "unavailable-folder" },
          ],
          error: null,
        }
      }

      return { data: null, error: new Error("Storage unavailable") }
    })
    const remove = vi.fn().mockResolvedValue({ error: null })

    await expect(purgeStoragePrefix(createBucket(list, remove), "user-1", "attachments")).resolves.toBeUndefined()

    expect(remove).toHaveBeenCalledWith(["user-1/avatar.png"])
    expect(errorSpy).toHaveBeenCalledWith(
      "[account/deleteAccount] Storage list error (attachments)",
      expect.objectContaining({ listErr: expect.any(Error) })
    )
  })

  it("logs remove errors without aborting cleanup", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const list = vi.fn().mockResolvedValue({
      data: [{ id: "root-file", name: "avatar.png" }],
      error: null,
    })
    const remove = vi.fn().mockResolvedValue({ error: new Error("Removal failed") })

    await expect(purgeStoragePrefix(createBucket(list, remove), "user-1", "attachments")).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      "[account/deleteAccount] Storage remove error (attachments)",
      expect.objectContaining({ removeErr: expect.any(Error) })
    )
  })
})
