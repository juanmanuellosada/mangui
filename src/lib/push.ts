/**
 * Web Push client utilities.
 * All functions run in the browser only.
 */

import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

/** Convert VAPID base64url public key to Uint8Array (backed by a plain ArrayBuffer) */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const array = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    array[i] = rawData.charCodeAt(i)
  }
  return array
}

export type PushStatus = "granted" | "denied" | "default" | "unsupported" | "subscribed"

/** Get the current push permission + subscription status */
export async function getPushStatus(): Promise<PushStatus> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported"
  }
  const perm = Notification.permission
  if (perm === "denied") return "denied"

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) return "subscribed"

  return perm === "granted" ? "granted" : "default"
}

/**
 * Subscribe to push notifications.
 * 1. Ensures service worker is ready
 * 2. Calls pushManager.subscribe
 * 3. Upserts the subscription into push_subscriptions via authenticated Supabase client
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    toast.error("Tu navegador no soporta notificaciones push")
    return false
  }

  const perm = await Notification.requestPermission()
  if (perm === "denied") {
    toast.error("Permiso denegado", {
      description: "Habilitá las notificaciones en la configuración del navegador.",
    })
    return false
  }
  if (perm !== "granted") return false

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set")
    toast.error("Error de configuración de notificaciones")
    return false
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as any,
    })

    const json = subscription.toJSON()
    const endpoint = json.endpoint!
    const p256dh = json.keys?.p256dh ?? ""
    const auth = json.keys?.auth ?? ""
    const userAgent = navigator.userAgent

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Sesión expirada — volvé a iniciar sesión")
      return false
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent },
      { onConflict: "user_id,endpoint" }
    )

    if (error) {
      console.error("[push] upsert error:", error)
      toast.error("Error al guardar la suscripción")
      return false
    }

    return true
  } catch (err) {
    console.error("[push] subscribe error:", err)
    toast.error("No se pudo activar las notificaciones")
    return false
  }
}

/**
 * Unsubscribe from push notifications.
 * Removes from pushManager and deletes the row in push_subscriptions.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return true

    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    const supabase = createClient()
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)

    return true
  } catch (err) {
    console.error("[push] unsubscribe error:", err)
    toast.error("Error al desactivar las notificaciones")
    return false
  }
}
