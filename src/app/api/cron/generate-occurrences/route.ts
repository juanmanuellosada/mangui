import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { advanceNextRun, computeNextRun } from "@/lib/recurring"
import { parseISO, startOfDay, isAfter, isBefore, isEqual } from "date-fns"
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
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    const querySecret = req.nextUrl.searchParams.get("secret")
    const provided = authHeader?.replace("Bearer ", "") ?? querySecret
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // --- Admin client ---
  const supabase = createAdminClient()
  if (!supabase) {
    console.warn("[generate-occurrences] No admin client — skipping.")
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 200 }
    )
  }

  const today = startOfDay(new Date())
  const todayStr = today.toISOString().split("T")[0]

  let processed = 0
  let offset = 0
  const errors: string[] = []

  // Process in batches to avoid memory issues on large datasets
  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("status", "active")
      .lte("next_run", todayStr)
      .not("next_run", "is", null)
      .range(offset, offset + BATCH_SIZE - 1)

    if (fetchErr) {
      console.error("[generate-occurrences] Fetch error:", fetchErr)
      return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 })
    }

    if (!batch || batch.length === 0) break

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
    offset += BATCH_SIZE
  }

  console.log(`[generate-occurrences] Done. processed=${processed} errors=${errors.length}`)

  return NextResponse.json({
    ok: true,
    processed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
