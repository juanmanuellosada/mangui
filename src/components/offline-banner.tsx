"use client"

import { useEffect, useState } from "react"
import { WifiOff, RefreshCw } from "lucide-react"
import { countQueued } from "@/lib/offline-queue"

/**
 * Shows a sticky banner when the browser reports being offline.
 * Also shows a pending-sync pill when there are queued offline movements,
 * even after connectivity is restored (until the queue drains).
 * Listens to window online/offline events and "mangui-queue-changed".
 * Hidden when online and queue is empty, or in SSR.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)

    async function refreshCount() {
      const n = await countQueued()
      setPendingCount(n)
    }
    refreshCount()

    const handleOnline = () => {
      setIsOnline(true)
      refreshCount()
    }
    const handleOffline = () => {
      setIsOnline(false)
      refreshCount()
    }
    const handleQueueChanged = () => refreshCount()

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("mangui-queue-changed", handleQueueChanged)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("mangui-queue-changed", handleQueueChanged)
    }
  }, [])

  if (!mounted) return null

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
