import { NextRequest, NextResponse } from "next/server"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Enums } from "@/lib/database.types"

type RateType = Enums<"rate_type">

/**
 * GET /api/cron/refresh-rates
 *
 * Fetches current DolarAPI rates and upserts them into exchange_rates.
 * Protected by CRON_SECRET env var when set (passed via Authorization header
 * or `secret` query param — Vercel Cron uses Authorization: Bearer <secret>).
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

  // --- Upsert ---
  const rows = entries.map(([rateType, data]) => ({
    rate_type: rateType as RateType,
    buy: data.buy,
    sell: data.sell,
    fetched_at: data.fetchedAt,
  }))

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "rate_type" })

  if (error) {
    console.error("[refresh-rates] upsert failed:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: rows.map((r) => r.rate_type) })
}
