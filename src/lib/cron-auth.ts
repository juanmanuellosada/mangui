import { NextRequest, NextResponse } from "next/server"

/**
 * Fail-closed auth check for cron routes (run with service_role privileges).
 *
 * If CRON_SECRET is not configured, requests are rejected — an unset secret
 * must never mean "anyone can invoke this," it must mean "cron is disabled."
 *
 * Returns a Response to send back if the request is unauthorized, or null
 * if the request is authorized and the route should proceed.
 */
export function assertCronAuth(req: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron-auth] CRON_SECRET is not set — rejecting request.")
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
  }

  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const provided = authHeader.slice("Bearer ".length)
  if (provided !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
