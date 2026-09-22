"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getIsDemo } from "@/lib/demo"
import { preApproval } from "@/lib/mercadopago"
import { createClient } from "@/lib/supabase/server"

const STORAGE_BUCKETS = ["attachments", "icons"] as const
const STORAGE_PAGE_SIZE = 100
const STORAGE_REMOVE_BATCH_SIZE = 100

type StorageEntry = {
  id?: string | null
  name: string
}

type StorageListResult = {
  data: StorageEntry[] | null
  error: unknown | null
}

type StorageRemoveResult = {
  error: unknown | null
}

export type StorageBucket = {
  list(path: string, options: { limit: number; offset: number }): Promise<StorageListResult>
  remove(paths: string[]): Promise<StorageRemoveResult>
}

function joinStoragePath(prefix: string, name: string): string {
  return `${prefix.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`
}

function isStorageFolder(entry: StorageEntry): boolean {
  return entry.id === null
}

/**
 * Removes every object reachable from a user Storage prefix. Supabase Storage
 * represents directories as entries with a null id, so each directory must be
 * listed separately before object paths can be removed.
 */
export async function purgeStoragePrefix(
  bucket: StorageBucket,
  prefix: string,
  bucketName: string
): Promise<void> {
  const paths: string[] = []

  async function collectPaths(path: string): Promise<void> {
    let offset = 0

    while (true) {
      let result: StorageListResult
      try {
        result = await bucket.list(path, { limit: STORAGE_PAGE_SIZE, offset })
      } catch (err) {
        console.error(`[account/deleteAccount] Unexpected Storage list error (${bucketName})`, {
          err,
        })
        return
      }

      if (result.error) {
        console.error(`[account/deleteAccount] Storage list error (${bucketName})`, {
          listErr: result.error,
        })
        return
      }

      const entries = result.data ?? []
      const folders: string[] = []

      for (const entry of entries) {
        const entryPath = joinStoragePath(path, entry.name)
        if (isStorageFolder(entry)) {
          folders.push(entryPath)
        } else {
          paths.push(entryPath)
        }
      }

      for (const folder of folders) {
        await collectPaths(folder)
      }

      if (entries.length < STORAGE_PAGE_SIZE) {
        return
      }
      offset += STORAGE_PAGE_SIZE
    }
  }

  await collectPaths(prefix)

  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const pathsToRemove = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE)

    try {
      const { error: removeErr } = await bucket.remove(pathsToRemove)
      if (removeErr) {
        console.error(`[account/deleteAccount] Storage remove error (${bucketName})`, { removeErr })
      }
    } catch (err) {
      console.error(`[account/deleteAccount] Unexpected Storage remove error (${bucketName})`, {
        err,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// deleteAccount
//
// Hard-deletes the authenticated user's account, all their data, and their
// Storage files. If a MercadoPago subscription exists, it is cancelled first.
//
// Cascade RESTRICT fix: movements, transfers and installment_purchases all
// have account_id REFERENCES accounts(id) ON DELETE RESTRICT.  Both tables
// also have user_id REFERENCES auth.users(id) ON DELETE CASCADE, so we delete
// them explicitly by user_id before calling deleteUser — ensuring that by the
// time Postgres cascades the accounts deletion there are no RESTRICT referrers
// left, and the cascade completes without violating FK constraints.
// ---------------------------------------------------------------------------

export async function deleteAccount(
  confirmation: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Server-side confirmation guard
  if (confirmation !== "ELIMINAR") {
    return { ok: false, error: "Confirmación incorrecta." }
  }

  // 2. Get authenticated user
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "No autenticado." }
  }

  // 3. Block demo account
  const isDemo = await getIsDemo()
  if (isDemo) {
    return { ok: false, error: "La cuenta demo no puede eliminarse." }
  }

  // 4. Admin client required
  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, error: "Servicio no disponible. Intentá de nuevo más tarde." }
  }

  const userId = user.id

  // 5. Cancel MercadoPago subscription if active — ABORT on failure
  const { data: profile } = await admin
    .from("profiles")
    .select("mp_preapproval_id")
    .eq("id", userId)
    .maybeSingle()

  if (profile?.mp_preapproval_id) {
    try {
      await preApproval.update({
        id: profile.mp_preapproval_id,
        body: { status: "cancelled" },
      })
    } catch (err) {
      console.error("[account/deleteAccount] MP cancellation error", { err })
      return {
        ok: false,
        error:
          "No se pudo cancelar la suscripción de MercadoPago. Tu cuenta no fue eliminada. Intentá de nuevo o contactá soporte.",
      }
    }
  }

  // 6. Purge Storage files (best-effort — a Storage orphan is tolerable)
  for (const bucketName of STORAGE_BUCKETS) {
    await purgeStoragePrefix(admin.storage.from(bucketName), userId, bucketName)
  }

  // 7. Pre-delete rows protected by ON DELETE RESTRICT on accounts(id)
  //    Order: movements and installment_purchases first (they don't depend on
  //    each other), then transfers.
  const restrictTables = ["movements", "installment_purchases", "transfers"] as const
  for (const table of restrictTables) {
    const { error: delErr } = await admin.from(table).delete().eq("user_id", userId)

    if (delErr) {
      console.error(`[account/deleteAccount] Failed to pre-delete ${table}`, { delErr })
      return {
        ok: false,
        error: `Error interno al eliminar datos (${table}). Tu cuenta no fue eliminada. Contactá soporte.`,
      }
    }
  }

  // 8. Delete the auth user — cascades all remaining FK ON DELETE CASCADE tables
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserErr) {
    console.error("[account/deleteAccount] deleteUser error", { deleteUserErr })
    return {
      ok: false,
      error: "No se pudo eliminar la cuenta. Contactá soporte.",
    }
  }

  // 9. Sign out (best-effort — user no longer exists so this may fail silently)
  try {
    await supabase.auth.signOut()
  } catch {
    // ignore
  }

  return { ok: true }
}
