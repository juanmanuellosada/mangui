import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertCronAuth } from "@/lib/cron-auth"
import { startOfDay } from "date-fns"

/**
 * GET /api/cron/activate-futures
 *
 * Sets is_future = false for every movement and transfer whose date has
 * arrived (date <= today). Runs at 03:00 UTC (00:00 Argentina time) so
 * records activate at the start of their local day.
 *
 * Protected by CRON_SECRET (same pattern as generate-occurrences).
 */
export async function GET(req: NextRequest) {
  // --- Auth check ---
  const authError = assertCronAuth(req)
  if (authError) return authError

  // --- Admin client ---
  const supabase = createAdminClient()
  if (!supabase) {
    console.warn("[activate-futures] No admin client — skipping.")
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 200 }
    )
  }

  const todayStr = startOfDay(new Date()).toISOString().split("T")[0]
  const now = new Date().toISOString()

  // --- Activate movements ---
  const { error: movErr, count: movCount } = await supabase
    .from("movements")
    .update({ is_future: false, updated_at: now })
    .eq("is_future", true)
    .lte("date", todayStr)

  if (movErr) {
    console.error("[activate-futures] movements update error:", movErr)
    return NextResponse.json({ ok: false, error: movErr.message }, { status: 500 })
  }

  // --- Activate transfers ---
  const { error: trfErr, count: trfCount } = await supabase
    .from("transfers")
    .update({ is_future: false, updated_at: now })
    .eq("is_future", true)
    .lte("date", todayStr)

  if (trfErr) {
    console.error("[activate-futures] transfers update error:", trfErr)
    return NextResponse.json({ ok: false, error: trfErr.message }, { status: 500 })
  }

  console.log(
    `[activate-futures] Done. movements=${movCount ?? 0} transfers=${trfCount ?? 0}`
  )

  return NextResponse.json({
    ok: true,
    movements: movCount ?? 0,
    transfers: trfCount ?? 0,
  })
}
