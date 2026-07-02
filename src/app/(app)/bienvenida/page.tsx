import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export const metadata: Metadata = {
  title: "Bienvenida",
}

export default async function BienvenidaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("default_currency")
    .eq("user_id", user!.id)
    .maybeSingle()

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    null

  return (
    <OnboardingWizard
      userId={user!.id}
      firstName={firstName}
      defaultCurrency={(prefs?.default_currency ?? "ARS") as "ARS" | "USD"}
    />
  )
}
