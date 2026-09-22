import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertCronAuth } from "@/lib/cron-auth"
import { advanceNextRun } from "@/lib/recurring"
import { todayAR } from "@/lib/date-utils"
import { parseISO, startOfDay, isAfter } from "date-fns"
import type { Tables } from "@/lib/database.types"

type RecurringTransaction = Tables<"recurring_transactions">

const BATCH_SIZE = 50

/**
 * GET /api/cron/generate-occurrences
 *
 * For every active recurring_transaction with next_run ≤ today:
 *   1. Upsert a pending recurring_occurrence (conflict = do nothing).
 *   2. Advance next_run by one period.
 *   3. If new next_run > end_date, set status = 'inactive'.
 *
 * Protected by CRON_SECRET (same pattern as refresh-rates).
 */
export async function GET(req: NextRequest) {
  // --- Auth check ---
  const authError = assertCronAuth(req)
  if (authError) return authError

  // --- Admin client ---
  const supabase = createAdminClient()
  if (!supabase) {
    console.warn("[generate-occurrences] No admin client — skipping.")
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 200 }
    )
  }

  const todayStr = todayAR()

  let processed = 0
  let lastProcessedId: string | undefined
  const errors: string[] = []

  // Keyset pagination remains stable while each processed row advances next_run.
  while (true) {
    let query = supabase
      .from("recurring_transactions")
      .select("*")
      .eq("status", "active")
      .lte("next_run", todayStr)
      .not("next_run", "is", null)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE)

    if (lastProcessedId) {
      query = query.gt("id", lastProcessedId)
    }

    const { data: batch, error: fetchErr } = await query

    if (fetchErr) {
      console.error("[generate-occurrences] Fetch error:", fetchErr)
      return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 })
    }

    if (!batch || batch.length === 0) break

    lastProcessedId = batch[batch.length - 1].id

    for (const rec of batch as RecurringTransaction[]) {
      try {
        if (!rec.next_run) continue

        const scheduledDate = rec.next_run

        // 1. Upsert occurrence — ON CONFLICT (recurring_id, scheduled_date) DO NOTHING
        const { error: occErr } = await supabase
          .from("recurring_occurrences")
          .upsert(
            {
              user_id: rec.user_id,
              recurring_id: rec.id,
              scheduled_date: scheduledDate,
              status: "pending",
            },
            { onConflict: "recurring_id,scheduled_date", ignoreDuplicates: true }
          )

        if (occErr) {
          console.error(`[generate-occurrences] Upsert occurrence failed for rec ${rec.id}:`, occErr)
          errors.push(`rec:${rec.id} upsert: ${occErr.message}`)
          continue
        }

        // 2. Compute next run after current
        const currentDate = startOfDay(parseISO(scheduledDate))
        const nextRunDate = advanceNextRun(rec, currentDate)
        const nextRunStr = nextRunDate.toISOString().split("T")[0]

        // 3. Determine new status
        let newStatus: "active" | "inactive" = "active"
        if (rec.end_date) {
          const endDate = startOfDay(parseISO(rec.end_date))
          if (isAfter(nextRunDate, endDate)) {
            newStatus = "inactive"
          }
        }

        // 4. Update recurring with new next_run and possibly status
        const { error: updateErr } = await supabase
          .from("recurring_transactions")
          .update({
            next_run: nextRunStr,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rec.id)

        if (updateErr) {
          console.error(`[generate-occurrences] Update next_run failed for rec ${rec.id}:`, updateErr)
          errors.push(`rec:${rec.id} update: ${updateErr.message}`)
          continue
        }

        processed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[generate-occurrences] Unexpected error for rec ${rec.id}:`, msg)
        errors.push(`rec:${rec.id} unexpected: ${msg}`)
      }
    }

    if (batch.length < BATCH_SIZE) break
  }

  console.log(`[generate-occurrences] Done. processed=${processed} errors=${errors.length}`)

  return NextResponse.json({
    ok: true,
    processed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
