import posthog from "posthog-js"
import { track as vercelTrack } from "@vercel/analytics"

/**
 * Helpers de analytics para el cliente — env-gated: si no hay
 * NEXT_PUBLIC_POSTHOG_KEY, o estamos en SSR, son no-ops totales (igual
 * que el resto de la instrumentación de la app, ver posthog-provider.tsx).
 */

export function track(event: string, props?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === "undefined") return
  posthog.capture(event, props)
  try {
    vercelTrack(event, props as Record<string, string | number | boolean | null | undefined>)
  } catch {
    // best-effort — Vercel Analytics no debe romper la UI si falla
  }
}

/** Asocia el resto del embudo (ya identificado por PostHog) a un usuario autenticado. */
export function identifyUser(userId: string): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === "undefined") return
  posthog.identify(userId)
}
