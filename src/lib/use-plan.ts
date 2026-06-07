"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { isPremium, getLimits, type PlanLimits } from "@/lib/plans"

interface PlanProfile {
  plan: string | null
  payment_exempt: boolean | null
  mp_subscription_status: string | null
}

interface UsePlanResult {
  isPremium: boolean
  limits: PlanLimits
  plan: string | null
  isLoading: boolean
}

async function fetchPlanProfile(): Promise<PlanProfile> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { plan: null, payment_exempt: null, mp_subscription_status: null }

  const { data } = await supabase
    .from("profiles")
    .select("plan, payment_exempt, mp_subscription_status")
    .eq("id", user.id)
    .single()

  return data ?? { plan: null, payment_exempt: null, mp_subscription_status: null }
}

export const PLAN_KEY = ["plan-profile"] as const

export function usePlan(): UsePlanResult {
  const { data, isLoading } = useQuery({
    queryKey: PLAN_KEY,
    queryFn: fetchPlanProfile,
    staleTime: 3 * 60 * 1000, // 3 minutes
  })

  const profile = data ?? { plan: null, payment_exempt: null, mp_subscription_status: null }
  const premium = isPremium(profile)

  return {
    isPremium: premium,
    limits: getLimits(premium),
    plan: profile.plan,
    isLoading,
  }
}
