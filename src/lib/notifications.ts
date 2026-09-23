import "server-only"
import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type AdminClient = SupabaseClient<Database>

/** Configure web-push once at module load */
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@mangui.com.ar"
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const vapidPrivate = process.env.VAPID_PRIVATE_KEY ?? ""

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
}

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
}

/**
 * Send a push notification to all subscriptions for a user.
 * Subscriptions that return 404/410 (gone) are deleted automatically.
 *
 * @returns Number of successful sends
 */
export async function sendPushToUser(
  admin: AdminClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!vapidPublic || !vapidPrivate) {
    console.warn("[notifications] VAPID keys not configured — skipping push")
    return 0
  }

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (error || !subs || subs.length === 0) return 0

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: payload.icon ?? "/icon-192.png",
  })

  let successCount = 0
  const staleIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        )
        successCount++
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          staleIds.push(sub.id)
        } else {
          console.error("[notifications] push send error:", err)
        }
      }
    })
  )

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds)
  }

  return successCount
}

/**
 * Sends an event at most once when a prior delivery was recorded.
 *
 * The log is written only after at least one device accepts the push, so a
 * temporary VAPID or subscription outage does not consume the event. The
 * pre-send lookup preserves normal duplicate suppression; concurrent cron
 * executions may still race between delivery and the final insert.
 */
export async function tryNotify(
  admin: AdminClient,
  userId: string,
  eventKey: string,
  send: () => Promise<number>
): Promise<boolean> {
  const { data: existing, error: lookupError } = await admin
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("event_key", eventKey)
    .maybeSingle()

  if (lookupError) {
    console.error("[notifications] tryNotify log lookup error:", lookupError)
    return false
  }
  if (existing) return false

  let successfulDeliveries: number
  try {
    successfulDeliveries = await send()
  } catch (err) {
    console.error("[notifications] tryNotify send error for", eventKey, err)
    return false
  }

  if (successfulDeliveries < 1) return false

  const { error: insertError } = await admin.from("notification_log").insert({
    user_id: userId,
    event_key: eventKey,
    channel: "push",
  })

  if (insertError && insertError.code !== "23505") {
    console.error("[notifications] tryNotify log insert error:", insertError)
  }

  return true
}
