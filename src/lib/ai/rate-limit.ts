import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { isPremium, FREE } from "@/lib/plans"

/**
 * Atomically checks and registers one unit of AI usage for `userId` against
 * the daily free-tier limit, via la RPC check_and_increment_ai_usage (ver
 * supabase/migrations/0042_atomic_ai_usage.sql). Los usuarios premium /
 * ai_unlimited nunca son bloqueados, pero su uso igual queda registrado.
 *
 * Devuelve `{ allowed: true }` si la llamada quedó dentro del límite (y se
 * registró), `{ allowed: false }` si se alcanzó el límite diario. Lanza si
 * falla la infraestructura (lookup de perfil / RPC) para que el caller
 * responda 500.
 */
export async function checkAiRateLimit(
  admin: SupabaseClient<Database>,
  userId: string,
  model: string
): Promise<{ allowed: boolean }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("ai_unlimited, plan, payment_exempt, mp_subscription_status")
    .eq("id", userId)
    .maybeSingle()

  const premiumByPlan = isPremium({
    payment_exempt: profile?.payment_exempt ?? null,
    mp_subscription_status: profile?.mp_subscription_status ?? null,
  })
  const isUnlimited = premiumByPlan || profile?.ai_unlimited === true

  const { data, error } = await admin.rpc("check_and_increment_ai_usage", {
    p_user_id: userId,
    p_limit: isUnlimited ? null : FREE.aiPerDay,
    p_model: model,
  })

  if (error) {
    throw new Error(`check_and_increment_ai_usage failed: ${error.message}`)
  }

  return { allowed: data === true }
}
