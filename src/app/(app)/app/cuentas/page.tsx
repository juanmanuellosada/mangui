import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { AccountsList } from "@/components/accounts/accounts-list"

export const metadata: Metadata = {
  title: "Cuentas",
}

export default async function AccountsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [prefsResult, rates] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("rate_type, manual_rate")
      .eq("user_id", user!.id)
      .maybeSingle(),
    fetchDolarRates(),
  ])

  const prefs = prefsResult.data
  const rateType = prefs?.rate_type ?? "blue"
  const manualRate = prefs?.manual_rate ?? null

  return <AccountsList rateType={rateType} manualRate={manualRate} rates={rates} />
}
