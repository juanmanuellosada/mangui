/**
 * bulkDelete — reusable helper for multi-select bulk deletion.
 *
 * Strategy:
 *  1. Try `.delete().in("id", ids)` in one shot.
 *  2. If that errors (e.g. accounts with FK restrict), fall back to
 *     deleting each id one at a time, tracking successes vs failures.
 *
 * Returns { deleted, failed, failedIds } so the caller can show a toast.
 */

import { createClient } from "@/lib/supabase/client"

export interface BulkDeleteResult {
  deleted: number
  failed: number
  failedIds: string[]
}

export async function bulkDelete(
  table: string,
  ids: string[]
): Promise<BulkDeleteResult> {
  if (ids.length === 0) return { deleted: 0, failed: 0, failedIds: [] }

  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: batchError } = await (supabase.from(table as any).delete() as any).in("id", ids)

  if (!batchError) {
    return { deleted: ids.length, failed: 0, failedIds: [] }
  }

  // Batch failed — fall back to one-by-one
  const failedIds: string[] = []
  let deleted = 0

  for (const id of ids) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: singleErr } = await (supabase.from(table as any).delete() as any).eq("id", id)
    if (singleErr) {
      failedIds.push(id)
    } else {
      deleted++
    }
  }

  return { deleted, failed: failedIds.length, failedIds }
}
