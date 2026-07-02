import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertCronAuth } from "@/lib/cron-auth"
import { sendPushToUser } from "@/lib/notifications"
import { nextCloseDate, computeDueDate, toDateString } from "@/lib/cards"
import { format, addDays, parseISO, startOfDay, isAfter } from "date-fns"

/**
 * GET /api/cron/send-notifications
 *
 * Sends deduped push notifications for:
 *  1. Card close/due reminders (if card_reminder_enabled)
 *  2. Pending recurring_occurrences with scheduled_date ≤ today
 *
 * Dedup: UNIQUE(user_id, event_key) on notification_log. If insert succeeds →
 * send. If it fails (duplicate) → already sent, skip.
 *
 * NOTE: notify_hour is stored per-user for future per-user timing. For MVP,
 * all notifications fire during this cron window (run hourly). To respect
 * notify_hour, compare the current UTC hour against user preference before
 * processing that user.
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

  // Fetch all users with push_enabled = true
  const { data: usersPrefs, error: prefsErr } = await admin
    .from("user_preferences")
    .select("user_id, push_enabled, card_reminder_enabled, notify_hour")
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

    // ── 1. Card reminders ──────────────────────────────────────────────────
    if (prefs.card_reminder_enabled) {
      const { data: cards } = await admin
        .from("accounts")
        .select("id, name, closing_day, due_day")
        .eq("user_id", userId)
        .eq("type", "tarjeta_credito")
        .not("closing_day", "is", null)
        .not("due_day", "is", null)

      for (const card of cards ?? []) {
        if (!card.closing_day || !card.due_day) continue

        const closeDate = nextCloseDate(card.closing_day, today)
        const closeDateStr = toDateString(closeDate)
        const dueDate = computeDueDate(closeDate, card.due_day, card.closing_day)
        const dueDateStr = toDateString(dueDate)

        // Close reminder: if within 3 days
        if (closeDateStr >= todayStr && closeDateStr <= in3DaysStr) {
          const eventKey = `card_close:${card.id}:${closeDateStr}`
          const daysUntil = Math.round(
            (parseISO(closeDateStr).getTime() - today.getTime()) / 86_400_000
          )
          const sent = await tryNotify(admin, userId, eventKey, async () => {
            await sendPushToUser(admin, userId, {
              title: `Cierre de ${card.name}`,
              body:
                daysUntil === 0
                  ? `Hoy cierra tu tarjeta ${card.name}.`
                  : `Tu tarjeta ${card.name} cierra en ${daysUntil} día${daysUntil !== 1 ? "s" : ""}.`,
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
    }

    // ── 2. Recurring occurrences ───────────────────────────────────────────
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

  }

  return NextResponse.json({ ok: true, processed: usersPrefs.length, sent: totalSent })
}

/**
 * Try to log the event_key first (idempotency guard).
 * If the insert succeeds → run the send callback.
 * If the insert fails with a duplicate error → already sent, skip.
 * Returns true if the notification was sent.
 */
async function tryNotify(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  eventKey: string,
  send: () => Promise<void>
): Promise<boolean> {
  if (!admin) return false

  const { error } = await admin.from("notification_log").insert({
    user_id: userId,
    event_key: eventKey,
    channel: "push",
  })

  if (error) {
    // Duplicate key → already sent
    if (error.code === "23505") return false
    console.error("[send-notifications] log insert error:", error)
    return false
  }

  try {
    await send()
    return true
  } catch (err) {
    console.error("[send-notifications] send error for", eventKey, err)
    return false
  }
}
