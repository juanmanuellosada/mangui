"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { WifiOff, RefreshCw } from "lucide-react"
import { countQueuedForUser } from "@/lib/offline-queue"
import { createClient } from "@/lib/supabase/client"

/**
 * Shows a sticky banner when the browser reports being offline.
 * Also shows a pending-sync pill when there are queued offline movements,
 * even after connectivity is restored (until the queue drains).
 * Listens to window online/offline events and "mangui-queue-changed".
 * Hidden when online and queue is empty, or in SSR.
 */
export function OfflineBanner() {
  const isOnline = useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify)
      window.addEventListener("offline", notify)
      return () => {
        window.removeEventListener("online", notify)
        window.removeEventListener("offline", notify)
      }
    },
    () => navigator.onLine,
    () => true,
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [userId, setUserId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let receivedAuthStateChange = false

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (active && !receivedAuthStateChange) setUserId(user?.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthStateChange = true
      if (active) setUserId(session?.user.id ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    async function refreshCount() {
      // Do not reveal another user's pending records while auth is unresolved.
      const n = userId ? await countQueuedForUser(userId) : 0
      if (active) setPendingCount(n)
    }
    void refreshCount()

    const handleConnectionChange = () => void refreshCount()
    window.addEventListener("online", handleConnectionChange)
    window.addEventListener("offline", handleConnectionChange)
    window.addEventListener("mangui-queue-changed", handleConnectionChange)
    return () => {
      active = false
      window.removeEventListener("online", handleConnectionChange)
      window.removeEventListener("offline", handleConnectionChange)
      window.removeEventListener("mangui-queue-changed", handleConnectionChange)
    }
  }, [userId])

  return (
    <>
      {/* Offline banner — only when disconnected */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-muted-foreground/90 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm"
          style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}
        >
          <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden />
          <span>Sin conexión — los datos ya cargados siguen disponibles</span>
        </div>
      )}

      {/* Pending-sync pill — shown even when back online, until queue drains */}
      {pendingCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 inset-x-0 z-50 flex justify-center pointer-events-none"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur-sm">
            <RefreshCw className="h-3 w-3 flex-shrink-0 animate-spin" aria-hidden />
            <span>
              {pendingCount} movimiento{pendingCount > 1 ? "s" : ""} sin sincronizar
            </span>
          </div>
        </div>
      )}
    </>
  )
}
