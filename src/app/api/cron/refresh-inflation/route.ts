import { NextRequest, NextResponse } from "next/server"
import { fetchIpcSeries, IPC_SERIES_ID } from "@/lib/inflation/indec"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/cron/refresh-inflation
 * Trae el IPC Nivel General (INDEC vía datos.gob.ar) y hace upsert por mes en
 * inflation_index (idempotente). Protegido por CRON_SECRET (Authorization: Bearer).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    const provided = authHeader?.replace("Bearer ", "")
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 200 })
  }

  const points = await fetchIpcSeries()
  if (points.length === 0) {
    return NextResponse.json({ ok: false, reason: "INDEC series returned no data" })
  }

  const source = `indec:${IPC_SERIES_ID}`
  const rows = points.map((p) => ({ period: p.period, ipc: p.ipc, source }))
  const { error } = await supabase.from("inflation_index").upsert(rows, { onConflict: "period" })
  if (error) {
    console.error("[refresh-inflation] upsert failed:", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, upserted: rows.length, latest: points[points.length - 1]?.period })
}
