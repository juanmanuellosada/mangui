import { NextRequest, NextResponse } from "next/server"
import { format, addDays, subDays, parseISO } from "date-fns"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"
import { WeeklyInsightsEmail } from "@/emails/weekly-insights"
import { generateInsights, type InsightInput } from "@/lib/insights/engine"
import { currentCycleSummary } from "@/lib/cards"
import { computeBudgetProgress } from "@/lib/budgets"
import { todayAR } from "@/lib/date-utils"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    const provided = authHeader?.replace("Bearer ", "")
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 200 }
    )
  }

  const todayStr = todayAR()
  const today = parseISO(todayStr)
  // ISO week key: same for all users this week — per-user uniqueness from UNIQUE(user_id, event_key)
  const weekKey = `weekly_insights:${format(today, "RRRR-'W'II")}`

  // Opted-in users
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("user_id")
    .eq("weekly_insights_enabled", true)

  if (!prefs || prefs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0 })
  }

  let sent = 0

  for (const p of prefs) {
    const userId = p.user_id

    // ── fetch accounts ──────────────────────────────────────────────────────
    const { data: accounts } = await admin
      .from("accounts")
      .select("id, name, type, currency, closing_day, due_day")
      .eq("user_id", userId)

    const cards = (accounts ?? []).filter(
      (a) => a.type === "tarjeta_credito" && a.closing_day != null
    )

    // ── fetch movements ─────────────────────────────────────────────────────
    const { data: allMovs } = await admin
      .from("movements")
      .select("id, type, amount, converted_amount, date, account_id, is_future")
      .eq("user_id", userId)

    const movements = allMovs ?? []

    // ── fetch budgets ───────────────────────────────────────────────────────
    const { data: budgets } = await admin
      .from("budgets")
      .select("*")
      .eq("user_id", userId)

    // ── fetch upcoming recurring occurrences (next 7 days) ──────────────────
    const in7Str = format(addDays(today, 7), "yyyy-MM-dd")
    const { data: occurrences } = await admin
      .from("recurring_occurrences")
      .select("amount_override, recurring_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", in7Str)

    // Fetch recurring_transactions amounts for those occurrence recurring_ids
    const recurringIds = [...new Set((occurrences ?? []).map((o) => o.recurring_id))]
    const recurringAmountMap: Record<string, number> = {}
    if (recurringIds.length > 0) {
      const { data: recurringRows } = await admin
        .from("recurring_transactions")
        .select("id, amount")
        .in("id", recurringIds)
      for (const r of recurringRows ?? []) {
        recurringAmountMap[r.id] = r.amount
      }
    }

    const recCount = (occurrences ?? []).length
    const recTotal = (occurrences ?? []).reduce((sum, o) => {
      return sum + (o.amount_override ?? recurringAmountMap[o.recurring_id] ?? 0)
    }, 0)

    // ── build InsightInput ──────────────────────────────────────────────────
    const insightCards = cards.map((c) => {
      const summary = currentCycleSummary(
        c.id,
        { closing_day: c.closing_day, due_day: c.due_day },
        movements,
        today
      )
      return {
        name: c.name,
        currency: c.currency as "ARS" | "USD",
        closeDate: summary.closeDate ?? todayStr,
        cycleAmount: summary.amount,
        prevStatementAmount: null as number | null,
      }
    })

    const insightBudgets = (budgets ?? [])
      .map((b) => ({
        name: (b.name as string) ?? "Presupuesto",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress: computeBudgetProgress(b as any, movements as any, today),
      }))
      .filter((b) => b.progress.status === "near" || b.progress.status === "exceeded")

    const weekAgoStr = format(subDays(today, 7), "yyyy-MM-dd")
    const twoWeeksAgoStr = format(subDays(today, 14), "yyyy-MM-dd")

    const expenses = movements.filter((m) => m.type === "expense" && !m.is_future)
    const thisWeek = expenses
      .filter((m) => m.date >= weekAgoStr && m.date <= todayStr)
      .reduce((s, m) => s + (m.converted_amount ?? m.amount), 0)
    const prevWeek = expenses
      .filter((m) => m.date >= twoWeeksAgoStr && m.date < weekAgoStr)
      .reduce((s, m) => s + (m.converted_amount ?? m.amount), 0)

    const input: InsightInput = {
      cards: insightCards,
      budgets: insightBudgets,
      upcomingRecurring: { count: recCount, total: recTotal },
      spend: { thisWeek, prevWeek },
    }

    const insights = generateInsights(input, today)
    if (insights.length === 0) continue

    // ── dedup once per ISO week ─────────────────────────────────────────────
    const { error: logErr } = await admin
      .from("notification_log")
      .insert({ user_id: userId, event_key: weekKey, channel: "weekly" })

    if (logErr) {
      if (logErr.code === "23505") continue // already sent this week
      console.error("[generate-insights] log error", logErr)
      continue
    }

    // ── push (teaser: first insight) ────────────────────────────────────────
    try {
      await sendPushToUser(admin, userId, {
        title: "Tu resumen semanal 🥭",
        body: insights[0].body,
        url: insights[0].url,
      })
    } catch (e) {
      console.error("[generate-insights] push error", e)
    }

    // ── email (full list) ───────────────────────────────────────────────────
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single()

      const email = profile?.email
      if (email) {
        await sendEmail({
          to: email,
          subject: "Tu resumen semanal de Mangui 🥭",
          react: WeeklyInsightsEmail({
            insights: insights.map((i) => ({ emoji: i.emoji, title: i.title, body: i.body })),
          }),
        })
      }
    } catch (e) {
      console.error("[generate-insights] email error", e)
    }

    sent++
  }

  return NextResponse.json({ ok: true, processed: prefs.length, sent })
}
