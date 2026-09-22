"use client"

import { useEffect } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import type { Tables } from "@/lib/database.types"

const RATE_TYPE_LABELS = {
  oficial: "Oficial",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
  manual: "Manual",
} as const

type UserPreferences = Tables<"user_preferences">

interface ExchangeRateRow {
  rate_type: string
  buy: number
  sell: number
  fetched_at: string
}

async function fetchExchangeRates(): Promise<Record<string, ExchangeRateRow>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("rate_type, buy, sell, fetched_at")
    .order("fetched_at", { ascending: false })
  if (error) throw error
  const seen = new Set<string>()
  const latest = (data ?? []).filter((r) => {
    if (seen.has(r.rate_type)) return false
    seen.add(r.rate_type)
    return true
  })
  const map: Record<string, ExchangeRateRow> = {}
  for (const row of latest) {
    map[row.rate_type] = row as ExchangeRateRow
  }
  return map
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const prefsSchema = z.object({
  default_currency: z.enum(["ARS", "USD"]),
  rate_type: z.enum(["oficial", "blue", "mep", "ccl", "manual"]),
  manual_rate: z.coerce.number().nullable(),
})
type PrefsFormValues = z.infer<typeof prefsSchema>

export function PreferencesSection({ prefs }: { prefs: UserPreferences | null }) {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<PrefsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(prefsSchema) as unknown as Resolver<PrefsFormValues, any>,
    defaultValues: {
      default_currency: prefs?.default_currency ?? "ARS",
      rate_type: prefs?.rate_type ?? "blue",
      manual_rate: prefs?.manual_rate ?? null,
    },
  })

  useEffect(() => {
    if (prefs) {
      reset({
        default_currency: prefs.default_currency,
        rate_type: prefs.rate_type,
        manual_rate: prefs.manual_rate ?? null,
      })
    }
  }, [prefs, reset])

  const rateType = useWatch({ control, name: "rate_type" })
  const currency = useWatch({ control, name: "default_currency" })

  // Fetch live exchange rates from the cached exchange_rates table
  const { data: exchangeRates, isLoading: ratesLoading } = useQuery({
    queryKey: ["exchange_rates"],
    queryFn: fetchExchangeRates,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const mutation = useMutation({
    mutationFn: async (values: PrefsFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from("user_preferences")
        .update({
          default_currency: values.default_currency,
          rate_type: values.rate_type,
          manual_rate: values.rate_type === "manual" ? values.manual_rate : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] })
      toast.success("Preferencias guardadas")
    },
    onError: (err: Error) => {
      toast.error("Error al guardar preferencias", { description: err.message })
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      {/* Demo hint */}
      {isDemo && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          No disponible en el modo demo
        </p>
      )}

      {/* Default currency — uses CurrencyToggle with coin icons */}
      <div className={cn("space-y-1.5", isDemo && "opacity-50 pointer-events-none")}>
        <Label>Moneda predeterminada</Label>
        <CurrencyToggle
          value={currency}
          onChange={(c) => setValue("default_currency", c, { shouldDirty: true })}
        />
      </div>

      {/* Rate type — with live compra/venta values from exchange_rates table */}
      <div className="space-y-1.5">
        <Label>Tipo de cotización USD</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(RATE_TYPE_LABELS) as [keyof typeof RATE_TYPE_LABELS, string][]).map(([key, label]) => {
            const liveRate = key !== "manual" ? exchangeRates?.[key] : undefined
            return (
              <button
                key={key}
                type="button"
                disabled={isDemo}
                onClick={() => setValue("rate_type", key, { shouldDirty: true })}
                title={isDemo ? "No disponible en el modo demo" : undefined}
                className={cn(
                  "flex flex-col items-start px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 press-effect",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isDemo
                    ? "cursor-not-allowed opacity-50 bg-muted/40 border-border/40 text-muted-foreground"
                    : "cursor-pointer",
                  !isDemo && rateType === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : !isDemo
                      ? "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
                      : ""
                )}
              >
                <span>{label}</span>
                {key !== "manual" && (
                  <span
                    className={cn(
                      "font-normal tabular-nums mt-0.5",
                      rateType === key && !isDemo ? "text-primary-foreground/75" : "text-muted-foreground/70"
                    )}
                  >
                    {ratesLoading
                      ? "…"
                      : liveRate
                        ? `$ ${formatRate(liveRate.buy)} / $ ${formatRate(liveRate.sell)}`
                        : "—"}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual rate */}
      {rateType === "manual" && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
          <Label htmlFor="manual-rate">Tipo de cambio manual (ARS por USD)</Label>
          <Input
            id="manual-rate"
            type="number"
            step="0.01"
            min="1"
            placeholder="Ej: 1250"
            className="tabular-nums"
            disabled={isDemo}
            {...register("manual_rate")}
            aria-invalid={!!errors.manual_rate}
          />
          <p className="text-xs text-muted-foreground">
            Se usará este valor cuando selecciones &quot;Manual&quot; como tipo de cambio en movimientos.
          </p>
        </div>
      )}

      <Button
        type="submit"
        className="press-effect"
        disabled={mutation.isPending || !isDirty || isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
      >
        {mutation.isPending ? "Guardando…" : "Guardar preferencias"}
      </Button>
    </form>
  )
}
