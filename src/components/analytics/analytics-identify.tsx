"use client"

import { useEffect } from "react"
import { identifyUser } from "@/lib/analytics"

/** Identifica al usuario autenticado ante PostHog para atribuir el embudo por persona. */
export function AnalyticsIdentify({ userId }: { userId: string }) {
  useEffect(() => {
    identifyUser(userId)
  }, [userId])

  return null
}
