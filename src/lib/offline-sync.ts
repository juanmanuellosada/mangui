/**
 * offline-sync.ts — drains the IndexedDB write queue by replaying mutations to Supabase.
 *
 * SSR-safe: returns early if IndexedDB is unavailable.
 */

import { getQueuedMovements, removeQueued } from "@/lib/offline-queue"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

interface DrainOpts {
  supabase: SupabaseClient<Database>
  onSynced?: () => void
}

interface DrainResult {
  synced: number
  failed: number
}

export async function drainQueue({ supabase, onSynced }: DrainOpts): Promise<DrainResult> {
  if (typeof indexedDB === "undefined") return { synced: 0, failed: 0 }

  const items = await getQueuedMovements()
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      const { error } = await supabase.from("movements").insert(item.payload as never)
      if (error) {
        // Permanent server-side error (RLS, validation, etc.) — discard so it doesn't block
        console.warn("[offline-sync] Permanent error for queued item, discarding:", error.message, item.id)
        await removeQueued(item.id)
        failed++
      } else {
        await removeQueued(item.id)
        synced++
        onSynced?.()
      }
    } catch (networkErr) {
      // Network failure — stop draining and keep remaining items for next time
      console.warn("[offline-sync] Network error during drain, stopping:", networkErr)
      break
    }
  }

  return { synced, failed }
}
