import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Service-role Supabase client. Bypasses RLS.
 * Use ONLY in server-side code (route handlers, server actions).
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not set.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn(
      "[admin] SUPABASE_SERVICE_ROLE_KEY is not set — admin client unavailable."
    )
    return null
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
