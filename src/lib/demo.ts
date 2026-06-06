import { createClient } from "@/lib/supabase/server"

/**
 * Server-side helper: returns true when the current session user is the demo account.
 * Use in Server Components and Server Actions.
 */
export async function getIsDemo(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from("profiles")
    .select("is_demo")
    .eq("id", user.id)
    .single()

  return data?.is_demo ?? false
}
