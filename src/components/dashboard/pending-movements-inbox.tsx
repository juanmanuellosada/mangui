"use client"

import { useQuery } from "@tanstack/react-query"
import { PendingInbox, type OccurrenceWithRec } from "@/components/recurring/pending-inbox"
import { todayAR } from "@/lib/date-utils"
import { OCCURRENCES_KEY } from "@/lib/recurring"
import { createClient } from "@/lib/supabase/client"

async function fetchPendingOccurrences(): Promise<OccurrenceWithRec[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select("*, recurring:recurring_transactions(*)")
    .eq("status", "pending")
    .lte("scheduled_date", todayAR())
    .order("scheduled_date", { ascending: true })

  if (error) throw error

  return (data ?? []) as OccurrenceWithRec[]
}

export function PendingMovementsInbox() {
  const { data: occurrences = [] } = useQuery({
    queryKey: [...OCCURRENCES_KEY, "pending"],
    queryFn: fetchPendingOccurrences,
  })

  if (occurrences.length === 0) return null

  return (
    <section aria-labelledby="pending-movements-heading" className="space-y-3">
      <h2 id="pending-movements-heading" className="text-base font-semibold">
        Pendientes por confirmar
      </h2>
      <PendingInbox occurrences={occurrences} accounts={[]} />
    </section>
  )
}
