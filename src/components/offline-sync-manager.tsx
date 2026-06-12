"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { drainQueue } from "@/lib/offline-sync"
import {
  MOVEMENTS_KEY,
  BALANCES_KEY,
  ACCOUNTS_KEY,
} from "@/lib/movements"
import { INSTALLMENTS_KEY } from "@/lib/installments"

/**
 * OfflineSyncManager — effect-only component (renders null).
 *
 * Drains the IndexedDB write queue when:
 *  - the component mounts (in case app was opened while online after queuing offline)
 *  - the browser fires a "online" event
 *  - the service worker sends a {type:"drain-queue"} message (background sync)
 *
 * Must be mounted inside PersistQueryClientProvider so useQueryClient() works.
 */
export function OfflineSyncManager() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()

    async function drain() {
      if (typeof navigator === "undefined" || !navigator.onLine) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { synced } = await drainQueue({ supabase })

      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
        queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
        queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
        queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
        toast.success(`${synced} movimiento${synced > 1 ? "s" : ""} sincronizado${synced > 1 ? "s" : ""}`)
      }
    }

    // Drain on mount
    drain()

    // Drain when connectivity is restored
    window.addEventListener("online", drain)

    // Drain when the service worker asks us to (background sync)
    function onSwMessage(event: MessageEvent) {
      if (event.data?.type === "drain-queue") {
        drain()
      }
    }

    let swMessageCleanup: (() => void) | undefined
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage)
      swMessageCleanup = () => navigator.serviceWorker.removeEventListener("message", onSwMessage)
    }

    return () => {
      window.removeEventListener("online", drain)
      swMessageCleanup?.()
    }
  }, [queryClient])

  return null
}
