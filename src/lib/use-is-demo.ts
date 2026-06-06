"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

async function fetchIsDemo(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from("profiles")
    .select("is_demo")
    .eq("id", user.id)
    .single()

  return data?.is_demo ?? false
}

export const IS_DEMO_KEY = ["is-demo"] as const

/**
 * Returns true when the currently logged-in user is the read-only demo account.
 * Cached via React Query (staleTime: 5 min — is_demo never changes mid-session).
 */
export function useIsDemo(): boolean {
  const { data } = useQuery({
    queryKey: IS_DEMO_KEY,
    queryFn: fetchIsDemo,
    staleTime: 5 * 60 * 1000,
  })
  return data ?? false
}
