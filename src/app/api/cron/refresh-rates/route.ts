import { NextRequest, NextResponse } from "next/server"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Enums } from "@/lib/database.types"
import { todayAR } from "@/lib/date-utils"

type RateType = Enums<"rate_type">

/**
 * GET /api/cron/refresh-rates
 *
 * Fetches current DolarAPI rates and appends a daily row per rate_type into
 * exchange_rates (one row per type per day — re-runs on the same day update
 * the existing row via the UNIQUE(rate_type, rate_date) conflict target).
 * Protected by CRON_SECRET env var when set (passed via Authorization header
 * or `secret` query param — Vercel Cron uses Authorization: Bearer <secret>).
 */
export async function GET(req: NextRequest) {
  // --- Auth check ---
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    const provided = authHeader?.replace("Bearer ", "")
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // --- Admin client ---
  const supabase = createAdminClient()
  if (!supabase) {
    console.warn("[refresh-rates] No admin client — skipping upsert.")
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 200 }
    )
  }

  // --- Fetch from DolarAPI ---
  const rates = await fetchDolarRates()
  const entries = Object.entries(rates) as [
    Exclude<RateType, "manual">,
    { buy: number; sell: number; fetchedAt: string },
  ][]

  if (entries.length === 0) {
    return NextResponse.json({ ok: false, reason: "DolarAPI returned no data" })
  }

  // --- Upsert (one row per type per day) ---
  const rateDate = todayAR()
  const rows = entries.map(([rateType, data]) => ({
    rate_type: rateType as RateType,
    buy: data.buy,
    sell: data.sell,
    fetched_at: data.fetchedAt,
    rate_date: rateDate,
  }))

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "rate_type,rate_date" })

  if (error) {
    console.error("[refresh-rates] upsert failed:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: rows.map((r) => r.rate_type) })
}
