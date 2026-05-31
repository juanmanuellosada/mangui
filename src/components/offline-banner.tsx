"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/**
 * Shows a sticky banner when the browser reports being offline.
 * Listens to window online/offline events.
 * Hidden when online or in SSR.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!mounted || isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-muted-foreground/90 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm"
      style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span>Sin conexión — los datos ya cargados siguen disponibles</span>
    </div>
  )
}
