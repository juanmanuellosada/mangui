"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface InflationRow {
  period: string
  ipc: number
}

async function fetchInflationIndex(): Promise<InflationRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("inflation_index")
    .select("period, ipc")
    .order("period", { ascending: true })
  if (error) throw error
  return (data ?? []) as InflationRow[]
}

export const INFLATION_INDEX_KEY = ["inflation_index"] as const

export function useInflationIndex() {
  return useQuery({
    queryKey: INFLATION_INDEX_KEY,
    queryFn: fetchInflationIndex,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
