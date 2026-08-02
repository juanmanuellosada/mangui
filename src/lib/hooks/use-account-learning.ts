"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ACCOUNT_LEARNING_KEY, fetchAccountLearning } from "@/lib/account-learning"

export function useAccountLearning() {
  return useQuery({
    queryKey: ACCOUNT_LEARNING_KEY,
    queryFn: () => fetchAccountLearning(createClient()),
  })
}
