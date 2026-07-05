import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertCronAuth } from "@/lib/cron-auth"
import { sendPushToUser, tryNotify } from "@/lib/notifications"
import { nextCloseDate, computeDueDate, toDateString, currentCycleSummary, dayOfMonth } from "@/lib/cards"
import { computeBudgetProgress, activeBudgetWindow } from "@/lib/budgets"
import { detectUnusualCharge } from "@/lib/insights/unusual"
import { formatCurrency } from "@/lib/utils"
import { amountInCurrency } from "@/lib/money"
import type { Tables } from "@/lib/database.types"
import { format, addDays, subDays, subMonths, parseISO, startOfDay } from "date-fns"

// Subset of movements used by the card/budget/unusual-charge blocks below,
// fetched once per user and reused across all three.
type MovementRow = Pick<
  Tables<"movements">,
  | "id"
  | "type"
  | "amount"
  | "converted_amount"
  | "date"
  | "category_id"
  | "account_id"
  | "is_future"
  | "created_at"
  | "original_currency"
>

/**
 * GET /api/cron/send-notifications
 *
 * Sends deduped push notifications for:
 *  1. Card close reminder (48hs, with projected amount) + due reminder (3 días) — if card_reminder_enabled
 *  2. Pending recurring_occurrences with scheduled_date ≤ today
 *  3. Budget alerts at configurable threshold (default 80%) usage / exceeded — if budget_alerts_enabled
 *  4. Unusual charge vs. category history — if unusual_charge_enabled
 *
 * Dedup: UNIQUE(user_id, event_key) on notification_log. If insert succeeds →
 * send. If it fails (duplicate) → already sent, skip.
 *
 * NOTE: notify_hour is stored per-user for future per-user timing. For MVP,
 * all notifications fire during this cron window (run hourly). To respect
 * notify_hour, compare the current UTC hour against user preference before
 * processing that user.
 *
 * ESCALA: hoy hay pocos usuarios, así que se hace ~1 query de movimientos
 * (~12 meses, reusada por los bloques de tarjeta/presupuesto/cargo inusual)
 * por usuario dentro del loop, más una consulta puntual de categoría si se
 * detecta un cargo inusual. Para escala real esto habría que batchear (traer
 * todo de una vez y agrupar en memoria, o mover a un worker con paginación)
 * en vez de N round-trips por usuario.
 */
export async function GET(req: NextRequest) {
  // Auth check
  const authError = assertCronAuth(req)
  if (authError) return authError

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 200 }
    )
  }

  const today = startOfDay(new Date())
  const todayStr = toDateString(today)
  const in3DaysStr = toDateString(addDays(today, 3))
  const in2DaysStr = toDateString(addDays(today, 2))
  const twoDaysAgoIso = subDays(new Date(), 2).toISOString()
  const twelveMonthsAgoStr = toDateString(subMonths(today, 12))

  // Fetch all users with push_enabled = true
  const { data: usersPrefs, error: prefsErr } = await admin
    .from("user_preferences")
    .select(
      "user_id, push_enabled, card_reminder_enabled, notify_hour, budget_alerts_enabled, unusual_charge_enabled"
    )
    .eq("push_enabled", true)

  if (prefsErr || !usersPrefs || usersPrefs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, prefsErr: prefsErr?.message })
  }

  const currentHour = new Date().getUTCHours()
  let totalSent = 0

  for (const prefs of usersPrefs) {
    const userId = prefs.user_id

    // MVP: only send during the user's preferred hour (or if notify_hour is 0)
    // Allow a 1-hour window. Skip if not in window.
    const notifyHour = prefs.notify_hour ?? 9
    if (notifyHour !== 0 && Math.abs(currentHour - notifyHour) > 1) {
      // Allow processing if hour matches; otherwise skip.
      // For MVP we allow all hours if notifyHour is 0.
      // Comment: In production, remove this skip to send regardless of hour,
      // or configure per-user cron triggers.
    }

    // ── Shared data: movements from the last ~12 months, fetched once and
    // reused by the card close projection, budget alerts, and unusual charge
    // detection below (avoids re-querying per block/card).
    let movements: MovementRow[] = []
    if (prefs.card_reminder_enabled || prefs.budget_alerts_enabled || prefs.unusual_charge_enabled) {
      const { data } = await admin
        .from("movements")
        .select("id, type, amount, converted_amount, date, category_id, account_id, is_future, created_at, original_currency")
        .eq("user_id", userId)
        .gte("date", twelveMonthsAgoStr)
      movements = data ?? []
    }

    // ── 1. Card reminders ──────────────────────────────────────────────────
    if (prefs.card_reminder_enabled) {
      try {
        const { data: cards } = await admin
          .from("accounts")
          .select("id, name, closing_date, due_date, currency")
          .eq("user_id", userId)
          .eq("type", "tarjeta_credito")
          .not("closing_date", "is", null)
          .not("due_date", "is", null)

        for (const card of cards ?? []) {
          if (!card.closing_date || !card.due_date) continue

          const closingDay = dayOfMonth(card.closing_date)
          const dueDay = dayOfMonth(card.due_date)
          const closeDate = nextCloseDate(closingDay, today)
          const closeDateStr = toDateString(closeDate)
          const dueDate = computeDueDate(closeDate, dueDay, closingDay)
          const dueDateStr = toDateString(dueDate)

          // Close reminder: 48hs window, enriched with the projected amount.
          if (closeDateStr >= todayStr && closeDateStr <= in2DaysStr) {
            const eventKey = `card_close:${card.id}:${closeDateStr}`
            const daysUntil = Math.round(
              (parseISO(closeDateStr).getTime() - today.getTime()) / 86_400_000
            )
            const when = daysUntil === 0 ? "hoy" : daysUntil === 1 ? "mañana" : `en ${daysUntil} días`

            const summary = currentCycleSummary(
              card.id,
              { closing_date: card.closing_date, due_date: card.due_date, currency: card.currency },
              movements,
              today
            )
            const amountStr = formatCurrency(summary.amount, card.currency)

            const sent = await tryNotify(admin, userId, eventKey, async () => {
              await sendPushToUser(admin, userId, {
                title: `Cierre de ${card.name}`,
                body: `Tu resumen de ${card.name} cierra ${when} y va ~${amountStr}.`,
                url: "/tarjetas",
              })
            })
            if (sent) totalSent++
          }

          // Due reminder: if within 3 days
          if (dueDateStr >= todayStr && dueDateStr <= in3DaysStr) {
            const eventKey = `card_due:${card.id}:${dueDateStr}`
            const daysUntil = Math.round(
              (parseISO(dueDateStr).getTime() - today.getTime()) / 86_400_000
            )
            const sent = await tryNotify(admin, userId, eventKey, async () => {
              await sendPushToUser(admin, userId, {
                title: `Vencimiento de ${card.name}`,
                body:
                  daysUntil === 0
                    ? `Hoy vence el pago de ${card.name}.`
                    : `El pago de ${card.name} vence en ${daysUntil} día${daysUntil !== 1 ? "s" : ""}.`,
                url: "/tarjetas",
              })
            })
            if (sent) totalSent++
          }
        }
      } catch (err) {
        console.error("[send-notifications] card reminders error for user", userId, err)
      }
    }

    // ── 2. Recurring occurrences ───────────────────────────────────────────
    try {
      const { data: occurrences } = await admin
        .from("recurring_occurrences")
        .select("id, scheduled_date, recurring_id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lte("scheduled_date", todayStr)

      for (const occ of occurrences ?? []) {
        const eventKey = `occurrence:${occ.id}`
        const sent = await tryNotify(admin, userId, eventKey, async () => {
          await sendPushToUser(admin, userId, {
            title: "Transacción recurrente pendiente",
            body: `Tenés una transacción recurrente programada para hoy (${format(parseISO(occ.scheduled_date), "d MMM")}).`,
            url: "/recurrentes",
          })
        })
        if (sent) totalSent++
      }
    } catch (err) {
      console.error("[send-notifications] recurring occurrences error for user", userId, err)
    }

    // ── 3. Budget alerts (umbral configurable, default 80% / excedido) ────
    if (prefs.budget_alerts_enabled) {
      try {
        const { data: budgets } = await admin
          .from("budgets")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")

        for (const budget of budgets ?? []) {
          const progress = computeBudgetProgress(budget, movements, today)
          if (progress.status === "on_track") continue

          const window = activeBudgetWindow(budget, today)
          const eventKey =
            progress.status === "exceeded"
              ? `budget_exceeded:${budget.id}:${window.from}`
              : `budget_near:${budget.id}:${window.from}`

          const title =
            progress.status === "exceeded"
              ? `Te pasaste de "${budget.name}"`
              : `Presupuesto "${budget.name}" al límite`
          const body =
            progress.status === "exceeded"
              ? `Te pasaste del presupuesto ${budget.name} (${formatCurrency(progress.spent, budget.currency)} de ${formatCurrency(progress.limit, budget.currency)}).`
              : `Vas al ${Math.round(progress.percent)}% de tu presupuesto ${budget.name}${
                  budget.alert_threshold !== 80 ? ` (avisamos desde el ${budget.alert_threshold}%)` : ""
                }.`

          const sent = await tryNotify(admin, userId, eventKey, async () => {
            await sendPushToUser(admin, userId, { title, body, url: "/presupuestos" })
          })
          if (sent) totalSent++
        }
      } catch (err) {
        console.error("[send-notifications] budget alerts error for user", userId, err)
      }
    }

    // ── 4. Unusual charge (cap: 1 aviso por usuario por corrida) ────────────
    if (prefs.unusual_charge_enabled) {
      try {
        const candidates = movements.filter(
          (m) => m.type === "expense" && !m.is_future && m.category_id && m.created_at >= twoDaysAgoIso
        )

        let best: { movement: (typeof candidates)[number]; ratio: number } | null = null
        for (const m of candidates) {
          const result = detectUnusualCharge(m, movements)
          if (result?.isUnusual && (!best || result.ratio > best.ratio)) {
            best = { movement: m, ratio: result.ratio }
          }
        }

        if (best) {
          const { data: category } = await admin
            .from("categories")
            .select("name")
            .eq("id", best.movement.category_id as string)
            .maybeSingle()

          // detectUnusualCharge compara todo en ARS (ver @/lib/insights/unusual),
          // así que el monto mostrado tiene que ser el mismo equivalente en ARS
          // para no rotular un monto convertido con la moneda original (o viceversa).
          const amount = amountInCurrency(best.movement, "ARS")
          const catName = category?.name ?? "sin categoría"
          const eventKey = `unusual_charge:${best.movement.id}`

          const sent = await tryNotify(admin, userId, eventKey, async () => {
            await sendPushToUser(admin, userId, {
              title: "Cargo inusual",
              body: `Cargo inusual: ${formatCurrency(amount, "ARS")} en ${catName}, ~${Math.round(best!.ratio)}x tu promedio.`,
              url: "/movimientos",
            })
          })
          if (sent) totalSent++
        }
      } catch (err) {
        console.error("[send-notifications] unusual charge error for user", userId, err)
      }
    }
  }

  return NextResponse.json({ ok: true, processed: usersPrefs.length, sent: totalSent })
}
