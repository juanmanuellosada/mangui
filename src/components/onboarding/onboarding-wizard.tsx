"use client"

/**
 * OnboardingWizard — wizard de 3 pasos que se muestra una única vez tras
 * el registro (ver detección en src/app/(app)/inicio/page.tsx, que redirige
 * a /bienvenida mientras profiles.onboarding_completed_at sea null).
 *
 * Overlay full-screen montado dentro de (app) para poder usar useQuickAdd()
 * en el paso 3. z-40 queda por debajo del MangoSheet del quick-add (z-50),
 * así que el sheet de "cargar gasto" aparece por encima sin ajustes extra.
 *
 * Paso 1 — moneda predeterminada (user_preferences.default_currency).
 * Paso 2 — primera cuenta (AccountForm, mismo insert que accounts-list.tsx).
 * Paso 3 — aha-moment: cargar el primer gasto con la AiFillBar del quick-add.
 *
 * Completar (o "Saltar todo") marca profiles.onboarding_completed_at y
 * vuelve a /inicio, que deja de redirigir acá.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, ArrowRight, Sparkles, Mic, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CurrencyToggle, type CurrencyValue } from "@/components/ui/currency-toggle"
import { AccountForm, type AccountFormValues } from "@/components/accounts/account-form"
import { createClient } from "@/lib/supabase/client"
import { useQuickAdd } from "@/components/quick-add-provider"
import { useIsDemo } from "@/lib/use-is-demo"
import { ACCOUNTS_KEY, BALANCES_KEY } from "@/lib/movements"
import type { Account } from "@/lib/accounts"
import { cn } from "@/lib/utils"

interface OnboardingWizardProps {
  userId: string
  firstName: string | null
  defaultCurrency: CurrencyValue
}

const STEPS = [1, 2, 3] as const
type Step = (typeof STEPS)[number]

export function OnboardingWizard({ userId, firstName, defaultCurrency }: OnboardingWizardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { open } = useQuickAdd()
  const isDemo = useIsDemo()

  const [step, setStep] = React.useState<Step>(1)
  const [currency, setCurrency] = React.useState<CurrencyValue>(defaultCurrency)

  // Belt-and-suspenders: /inicio never redirects the demo account here, but
  // bail out client-side too in case someone lands on /bienvenida directly.
  React.useEffect(() => {
    if (isDemo) router.replace("/inicio")
  }, [isDemo, router])

  const completeMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      toast.success("¡Listo! Ya podés usar Mangui 🥭")
      router.push("/inicio")
    },
    onError: (err: Error) => {
      toast.error("No se pudo completar el onboarding", { description: err.message })
    },
  })

  const currencyMutation = useMutation({
    mutationFn: async (value: CurrencyValue) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("user_preferences")
        .update({ default_currency: value, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] })
      setStep(2)
    },
    onError: (err: Error) => {
      toast.error("No se pudo guardar la moneda", { description: err.message })
    },
  })

  const accountMutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          user_id: userId,
          name: values.name,
          type: values.type,
          currency: values.currency,
          initial_balance: values.initial_balance,
          icon: values.icon,
          color: values.color,
          is_hidden: values.is_hidden,
          account_number:
            values.type !== "tarjeta_credito" && values.account_number
              ? values.account_number
              : null,
          closing_day: values.type === "tarjeta_credito" ? (values.closing_day ?? null) : null,
          due_day: values.type === "tarjeta_credito" ? (values.due_day ?? null) : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (newAccount) => {
      queryClient.setQueryData<Account[]>(ACCOUNTS_KEY, (old = []) => [...old, newAccount])
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      toast.success("Cuenta creada")
      setStep(3)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la cuenta", { description: err.message })
    },
  })

  if (isDemo) return null

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="min-h-full flex flex-col items-center px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="w-full max-w-md space-y-6">
          {/* Saltar todo */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Saltar todo
            </button>
          </div>

          {/* Saludo */}
          <div className="text-center space-y-1">
            <p className="text-3xl" aria-hidden>
              🥭
            </p>
            <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              {firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configuremos tu cuenta en 3 pasos rápidos.
            </p>
          </div>

          {/* Stepper */}
          <ol role="list" aria-label="Progreso del onboarding" className="flex items-center">
            {STEPS.map((n) => (
              <li key={n} className="flex-1 flex items-center last:flex-none">
                <span
                  aria-current={step === n ? "step" : undefined}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold border transition-colors duration-150",
                    step === n && "bg-primary text-primary-foreground border-primary",
                    step > n && "bg-primary/15 text-primary border-primary/30",
                    step < n && "bg-muted/40 text-muted-foreground border-border/60"
                  )}
                >
                  {step > n ? <Check className="h-4 w-4" aria-hidden /> : n}
                </span>
                {n !== 3 && (
                  <span
                    aria-hidden
                    className={cn(
                      "h-0.5 flex-1 mx-2 rounded-full transition-colors duration-150",
                      step > n ? "bg-primary/40" : "bg-border/60"
                    )}
                  />
                )}
              </li>
            ))}
          </ol>

          {/* Contenido del paso */}
          <div className="rounded-2xl border border-border/60 bg-popover p-5 sm:p-6 space-y-4 animate-scale-in">
            {step === 1 && (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">
                    ¿En qué moneda manejás tu plata?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Vas a poder cambiarla cuando quieras desde Ajustes.
                  </p>
                </div>
                <CurrencyToggle value={currency} onChange={setCurrency} />
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setStep(2)}
                  >
                    Omitir
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-1.5"
                    onClick={() => currencyMutation.mutate(currency)}
                    disabled={currencyMutation.isPending}
                  >
                    {currencyMutation.isPending ? "Guardando…" : "Continuar"}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Creá tu primera cuenta</h2>
                  <p className="text-sm text-muted-foreground">
                    Bancaria, billetera virtual o efectivo — la que uses más seguido.
                  </p>
                </div>
                <AccountForm
                  userId={userId}
                  submitLabel="Crear mi cuenta"
                  isLoading={accountMutation.isPending}
                  onSubmit={async (values) => {
                    await accountMutation.mutateAsync(values)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Omitir por ahora
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Cargá tu primer gasto</h2>
                  <p className="text-sm text-muted-foreground">
                    Escribilo, dictalo por voz o sacale una foto al ticket — la IA lo
                    completa por vos.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Texto
                  </span>
                  <span className="flex items-center gap-1">
                    <Mic className="h-3.5 w-3.5" aria-hidden />
                    Voz
                  </span>
                  <span className="flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                    Foto
                  </span>
                </div>
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={() => open("movement", "expense")}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Cargar mi primer gasto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? "Guardando…" : "Listo, terminar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
