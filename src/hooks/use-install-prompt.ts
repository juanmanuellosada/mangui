"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let installedViaAppEvent = false

function subscribeToInstalledState(notify: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)")
  const appInstalled = () => {
    installedViaAppEvent = true
    notify()
  }
  window.addEventListener("appinstalled", appInstalled)
  displayMode.addEventListener("change", notify)
  return () => {
    window.removeEventListener("appinstalled", appInstalled)
    displayMode.removeEventListener("change", notify)
  }
}

function getInstalledSnapshot() {
  return installedViaAppEvent || window.matchMedia("(display-mode: standalone)").matches
}

/**
 * Captures the browser's beforeinstallprompt event for PWA install.
 * Returns a trigger function that shows the native install prompt.
 * `canInstall` is false when: not available, already installed, or dismissed.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const isInstalled = useSyncExternalStore(
    subscribeToInstalledState,
    getInstalledSnapshot,
    () => false,
  )

  useEffect(() => {
    if (isInstalled) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    const appInstalled = () => {
      setCanInstall(false)
      setDeferredPrompt(null)
    }
    window.addEventListener("appinstalled", appInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", appInstalled)
    }
  }, [isInstalled])

  const triggerInstall = async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      installedViaAppEvent = true
      setCanInstall(false)
    }
    setDeferredPrompt(null)
    return outcome === "accepted"
  }

  return { canInstall, isInstalled, triggerInstall }
}
