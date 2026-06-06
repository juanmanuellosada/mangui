"use server"

import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const DAILY_LIMIT = 30

// Argentina timezone offset for "today" — must match the route
const AR_TZ = "America/Argentina/Buenos_Aires"

function getTodayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: AR_TZ })
}

export type AiUsageTodayResult =
  | { ok: true; used: number; limit: number; unlimited: boolean }
  | { ok: false; error: string }

/**
 * Returns how many AI interpretations the user has used today,
 * the daily limit, and whether the user is exempt from the limit.
 */
export async function getAiUsageToday(): Promise<AiUsageTodayResult> {
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
    return { ok: false, error: "Servicio no disponible" }
  }

  const [profileRes, usageRes] = await Promise.all([
    admin.from("profiles").select("ai_unlimited").eq("id", user.id).maybeSingle(),
    admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${getTodayAR()}T00:00:00.000Z`),
  ])

  if (profileRes.error) {
    return { ok: false, error: profileRes.error.message }
  }
  if (usageRes.error) {
    return { ok: false, error: usageRes.error.message }
  }

  return {
    ok: true,
    used: usageRes.count ?? 0,
    limit: DAILY_LIMIT,
    unlimited: profileRes.data?.ai_unlimited === true,
  }
}
