"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { AR_TZ } from "@/lib/date-utils"

/** Returns the ISO timestamp for the first moment of the current month in Argentina TZ. */
function firstOfMonthAR(): string {
  const now = new Date()
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, year: "numeric" }).format(now)
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, month: "2-digit" }).format(now)
  // e.g. "2026-06-01T00:00:00-03:00" — AR month start, fixed UTC-3 (no DST)
  return `${year}-${month}-01T00:00:00-03:00`
}

async function fetchMonthlyAttachmentCount(): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const since = firstOfMonthAR()

  const { count, error } = await supabase
    .from("movement_attachments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since)

  if (error) return 0
  return count ?? 0
}

export function useMonthlyAttachmentCount(): { count: number; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["monthly-attachment-count"],
    queryFn: fetchMonthlyAttachmentCount,
    staleTime: 60_000,
  })

  return { count: data ?? 0, isLoading }
}
