"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, X } from "lucide-react"
import { useIsDemo } from "@/lib/use-is-demo"
import { cn } from "@/lib/utils"

/**
 * Persistent banner shown at the top of the app shell when the user is
 * in the read-only demo account. Dismissible per session (localStorage).
 */
export function DemoBanner() {
  const isDemo = useIsDemo()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem("demo-banner-dismissed") === "1"
  })

  if (!isDemo || dismissed) return null

  function dismiss() {
    sessionStorage.setItem("demo-banner-dismissed", "1")
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className={cn(
        "relative flex items-center justify-between gap-3 px-4 py-2.5",
        "bg-primary/10 border-b border-primary/20 text-sm"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 text-primary flex-shrink-0" aria-hidden />
        <span className="text-foreground/80 leading-snug">
          Estás en el{" "}
          <span className="font-semibold text-primary">modo demo</span>{" "}
          (solo lectura).
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/register"
          className={cn(
            "text-xs font-semibold px-3 py-1 rounded-full",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          Crear cuenta
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso de demo"
          className={cn(
            "p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
