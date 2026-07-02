import "server-only"

const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

/**
 * Trackea un evento server-side vía el endpoint de captura HTTP de PostHog
 * (sin depender de posthog-node). Env-gated: no-op sin NEXT_PUBLIC_POSTHOG_KEY.
 * Nunca lanza — está pensado para llamarse desde webhooks que no deben romper
 * su flujo principal si el tracking falla.
 */
export async function trackServer(
  event: string,
  distinctId: string,
  props?: Record<string, unknown>
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: props,
      }),
    })
  } catch {
    // best-effort — nunca debe romper el flujo que lo llama
  }
}
