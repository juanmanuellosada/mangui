"use server"

import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptSecret, decryptSecret } from "@/lib/crypto"

export type AiProvider = "google" | "openai" | "anthropic"

export type AiSettingsResult =
  | { ok: true; provider: AiProvider; model: string | null; hasKey: boolean }
  | { ok: false; error: string }

export type SaveAiSettingsResult = { ok: true } | { ok: false; error: string }

/**
 * Returns the user's AI provider/model settings.
 * NEVER returns the API key — only hasKey: boolean.
 */
export async function getAiSettings(): Promise<AiSettingsResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "No autenticado" }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, error: "Servicio no disponible (admin client)" }
  }

  const { data, error } = await admin
    .from("user_ai_settings")
    .select("provider, model, api_key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!data) {
    return { ok: true, provider: "google", model: null, hasKey: false }
  }

  return {
    ok: true,
    provider: data.provider as AiProvider,
    model: data.model,
    hasKey: !!data.api_key_encrypted,
  }
}

/**
 * Saves provider + model. If apiKey is provided, encrypts and stores it.
 * If apiKey is empty/undefined, preserves the existing key.
 */
export async function saveAiSettings(params: {
  provider: AiProvider
  model: string
  apiKey?: string
}): Promise<SaveAiSettingsResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "No autenticado" }
  }

  if (!["google", "openai", "anthropic"].includes(params.provider)) {
    return { ok: false, error: "Proveedor no válido" }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, error: "Servicio no disponible (admin client)" }
  }

  // Build the update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    user_id: user.id,
    provider: params.provider,
    model: params.model || null,
    updated_at: new Date().toISOString(),
  }

  if (params.apiKey && params.apiKey.trim().length > 0) {
    payload.api_key_encrypted = await encryptSecret(params.apiKey.trim())
  }

  // Upsert — if no row exists for this user, create it; otherwise update
  if (params.apiKey && params.apiKey.trim().length > 0) {
    const { error } = await admin
      .from("user_ai_settings")
      .upsert(payload, { onConflict: "user_id" })

    if (error) {
      return { ok: false, error: error.message }
    }
  } else {
    // Don't include api_key_encrypted so we don't wipe the existing key
    const { data: existing } = await admin
      .from("user_ai_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from("user_ai_settings")
        .update({
          provider: params.provider,
          model: params.model || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)

      if (error) {
        return { ok: false, error: error.message }
      }
    } else {
      // Insert without a key
      const { error } = await admin
        .from("user_ai_settings")
        .insert({
          user_id: user.id,
          provider: params.provider,
          model: params.model || null,
        })

      if (error) {
        return { ok: false, error: error.message }
      }
    }
  }

  return { ok: true }
}

/**
 * Clears the stored API key (sets api_key_encrypted = null).
 * Provider/model are preserved.
 */
export async function removeAiKey(): Promise<SaveAiSettingsResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "No autenticado" }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, error: "Servicio no disponible (admin client)" }
  }

  const { error } = await admin
    .from("user_ai_settings")
    .update({
      api_key_encrypted: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

/**
 * Server-only: decrypts and returns the raw API key.
 * Only called from API routes (parse-movement), never from the client.
 */
export async function getDecryptedApiKey(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from("user_ai_settings")
    .select("api_key_encrypted")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data?.api_key_encrypted) return null

  try {
    return await decryptSecret(data.api_key_encrypted)
  } catch {
    return null
  }
}
