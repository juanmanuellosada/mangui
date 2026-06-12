"use client"

import { useEffect } from "react"
import { useQuickAdd } from "@/components/quick-add-provider"
import type { AiExtractResult } from "@/components/movements/ai-fill-bar"

/**
 * Reads the `mangui-share-draft` cookie set by the /compartir route handler,
 * clears it immediately, then opens the QuickAdd form prefilled with the result.
 * Renders nothing — side-effect only.
 */
export function ShareDraftReader() {
  const { openWithAiResult } = useQuickAdd()

  useEffect(() => {
    try {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("mangui-share-draft="))
      if (!match) return

      const raw = match.split("=").slice(1).join("=")
      // Clear the cookie immediately
      document.cookie = "mangui-share-draft=; Max-Age=0; path=/"

      const draft = JSON.parse(decodeURIComponent(raw)) as AiExtractResult
      openWithAiResult(draft)
    } catch {
      // Malformed cookie — ignore silently
    }
  // openWithAiResult is stable (useCallback), runs once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
