"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Crown, Sparkles } from "lucide-react"
import { subscribeToPremium, cancelSubscription } from "@/app/actions/subscription"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { track } from "@/lib/analytics"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"
import { usePlan, PLAN_KEY } from "@/lib/use-plan"
import { PREMIUM_PRICE_ARS, ANNUAL_PRICE_ARS, FREE } from "@/lib/plans"
import { cn } from "@/lib/utils"

interface PlanProfile {
  plan: string | null
  payment_exempt: boolean | null
  mp_subscription_status: string | null
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

export function PlanSection() {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const { isLoading } = usePlan()
  const { data: planProfile } = useQuery<PlanProfile>({
    queryKey: PLAN_KEY,
    queryFn: fetchPlanProfile,
    staleTime: 3 * 60 * 1000,
  })
  const paymentExempt = planProfile?.payment_exempt === true
  const hasActiveSub = planProfile?.mp_subscription_status === "authorized"

  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("monthly")

  const monthlyFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(PREMIUM_PRICE_ARS)

  const annualFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(ANNUAL_PRICE_ARS)

  const handleSubscribe = async () => {
    if (isDemo || subscribing) return
    setSubscribing(true)
    try {
      const result = await subscribeToPremium(selectedInterval)
      if (result.ok) {
        track("checkout_started", { interval: selectedInterval })
        window.location.href = result.initPoint
      } else {
        toast.error("No se pudo iniciar el pago", { description: result.error })
      }
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancel = async () => {
    if (isDemo || cancelling) return
    const confirmed = window.confirm(
      "¿Cancelar tu suscripción Premium? Perderás el acceso a las funciones premium al final del período."
    )
    if (!confirmed) return
    setCancelling(true)
    try {
      const result = await cancelSubscription()
      if (result.ok) {
        toast.success("Suscripción cancelada. Los cambios se reflejarán en breve.")
        queryClient.invalidateQueries({ queryKey: PLAN_KEY })
      } else {
        toast.error("No se pudo cancelar", { description: result.error })
      }
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-40" />
      </div>
    )
  }

  // Exempt (courtesy) premium
  if (paymentExempt) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Premium (cortesía)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tenés acceso completo a Premium de forma gratuita.
        </p>
      </div>
    )
  }

  // Paid premium
  if (hasActiveSub) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Plan Premium</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            <Check className="h-3 w-3" aria-hidden="true" />
            activo
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Acceso ilimitado a cuentas, presupuestos, metas, recurrentes, reglas automáticas, adjuntos, export CSV e IA sin límite.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling || isDemo}
          title={isDemo ? "No disponible en el modo demo" : undefined}
          className="gap-1.5 text-muted-foreground border-border/60 hover:text-destructive hover:border-destructive/30 press-effect cursor-pointer"
        >
          {cancelling ? "Cancelando…" : "Cancelar suscripción"}
        </Button>
      </div>
    )
  }

  // Free plan
  const usageLimits = [
    { label: "Cuentas", value: `${FREE.accounts}` },
    { label: "Presupuestos", value: `${FREE.budgets}` },
    { label: "Metas", value: `${FREE.goals}` },
    { label: "Recurrentes", value: `${FREE.recurring}` },
    { label: "Reglas", value: `${FREE.rules}` },
    { label: "Adjuntos", value: `${FREE.attachments}/mes` },
    { label: "IA", value: `${FREE.aiPerDay}/día` },
    { label: "Export CSV", value: "Premium" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Plan Free</span>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 divide-y divide-border/40">
        {usageLimits.map(({ label, value }) => {
          const isPremiumLabel = value === "Premium"
          return (
            <div key={label} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isPremiumLabel ? "text-accent/70 italic" : "text-foreground"
                )}
              >
                {value}
              </span>
            </div>
          )
        })}
      </div>

      {/* Interval toggle */}
      <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-1 gap-1">
        {(["monthly", "annual"] as const).map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setSelectedInterval(iv)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedInterval === iv
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {iv === "monthly" ? "Mensual" : "Anual"}
          </button>
        ))}
      </div>

      {/* Price display */}
      <div className="text-center space-y-0.5">
        {selectedInterval === "monthly" ? (
          <p className="text-sm font-semibold tabular-nums">{monthlyFormatted}/mes</p>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums">{annualFormatted}/año</p>
            <p className="text-xs text-primary font-medium">2 meses gratis (≈ 17% off)</p>
          </>
        )}
      </div>

      {isDemo && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          No disponible en el modo demo
        </p>
      )}

      <Button
        type="button"
        onClick={handleSubscribe}
        disabled={subscribing || isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
        className="w-full gap-2 font-semibold press-effect shadow-sm shadow-primary/20"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {subscribing
          ? "Redirigiendo…"
          : selectedInterval === "monthly"
            ? `Mejorá a Premium · ${monthlyFormatted}/mes`
            : `Mejorá a Premium · ${annualFormatted}/año`}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Cancelás cuando quieras. El pago se procesa con MercadoPago.
      </p>
    </div>
  )
}
