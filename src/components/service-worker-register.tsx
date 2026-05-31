"use client"

import { useEffect } from "react"

/**
 * Registers /sw.js in production only.
 * In development, HMR conflicts with service worker fetch interception,
 * so we skip registration. Verify offline/push via: npm run build && npm start.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err)
      })
  }, [])

  return null
}
