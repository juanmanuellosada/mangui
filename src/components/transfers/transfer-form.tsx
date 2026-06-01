"use client"

import { useEffect, useRef, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { parseISO } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { AttachmentSlot } from "@/components/ui/attachment-slot"
import { Switch } from "@/components/ui/switch"
import { formatCurrency } from "@/lib/utils"
import { fetchDolarRates, type RatesMap } from "@/lib/rates/dolar"
import { AccountIconChip, type Account } from "@/lib/accounts"
import { isFutureDate } from "@/lib/date-utils"
import { listTransferAttachments, type MovementAttachment } from "@/lib/attachments"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import type { RateType } from "@/lib/rates/dolar"

export type TransferFormValues = {
  from_account_id: string
  to_account_id: string
  from_amount: number
  to_amount: number
  date: string
  note: string
  is_future: boolean
}

const transferSchema = z
  .object({
    from_account_id: z.string().min(1, "Seleccioná la cuenta origen"),
    to_account_id: z.string().min(1, "Seleccioná la cuenta destino"),
    from_amount: z.coerce.number().positive("El monto origen debe ser mayor a 0"),
    to_amount: z.coerce.number().positive("El monto destino debe ser mayor a 0"),
    date: z.string().min(1, "Seleccioná una fecha"),
    note: z.string(),
    is_future: z.boolean(),
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    message: "La cuenta origen y destino deben ser distintas",
    path: ["to_account_id"],
  })

// ── User preferences fetcher (reuses the ["preferences"] cache) ───────────────

interface UserPrefs {
  rate_type: RateType
  manual_rate: number | null
}

async function fetchPreferences(): Promise<UserPrefs> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rate_type: "blue", manual_rate: null }
  const { data } = await supabase
    .from("user_preferences")
    .select("rate_type, manual_rate")
    .eq("user_id", user.id)
    .single()
  return {
    rate_type: (data?.rate_type as RateType) ?? "blue",
    manual_rate: data?.manual_rate ?? null,
  }
}

// ── Rate type labels (Spanish) ─────────────────────────────────────────────────

const RATE_LABELS: Record<RateType, string> = {
  oficial: "Oficial",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
  manual: "Manual",
}

interface TransferFormProps {
  accounts: Account[]
  defaultValues?: Partial<TransferFormValues>
  onSubmit: (values: TransferFormValues, pendingComprobante?: File | null) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
  /** Edit mode: pass the transfer id to load existing attachment */
  transferId?: string
  /** Edit mode: called after a persisted attachment is deleted */
  onAttachmentDeleted?: () => void
}

export function TransferForm({
  accounts,
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar",
  transferId,
  onAttachmentDeleted,
}: TransferFormProps) {
  const today = new Date().toISOString().split("T")[0]

  // Transfers exclude credit cards from both origin and destination
  const transferAccounts = accounts.filter((a) => a.type !== "tarjeta_credito")

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransferFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(transferSchema) as unknown as Resolver<TransferFormValues, any>,
    defaultValues: {
      from_account_id: transferAccounts[0]?.id ?? "",
      to_account_id: transferAccounts[1]?.id ?? transferAccounts[0]?.id ?? "",
      from_amount: 0,
      to_amount: 0,
      date: today,
      note: "",
      is_future: false,
      ...defaultValues,
    },
  })

  const fromAccountId = watch("from_account_id")
  const toAccountId = watch("to_account_id")
  const fromAmount = watch("from_amount")
  const toAmount = watch("to_amount")
  const dateStr = watch("date")

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isCrossCurrency =
    !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency

  // ── User preferences (rate_type + manual_rate) ────────────────────────────────
  const { data: prefs } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  })

  const configuredRateType: RateType = prefs?.rate_type ?? "blue"
  const configuredManualRate: number | null = prefs?.manual_rate ?? null

  // ── Exchange rate fetching ────────────────────────────────────────────────────
  const { data: ratesMap } = useQuery<RatesMap>({
    queryKey: ["dolar_rates"],
    queryFn: fetchDolarRates,
    staleTime: 30 * 60 * 1000, // 30 min
  })

  // Numeric rate being applied (for display)
  const [appliedRate, setAppliedRate] = useState<number | null>(null)

  // Tracks which amount field the user last edited — prevents bidirectional loop
  const lastEdited = useRef<"from" | "to">("from")

  // Controls whether the cross-currency auto-compute is active
  const [autoComplete, setAutoComplete] = useState(true)

  // Compute to_amount from from_amount using the configured rate
  const computeToAmount = (amount: number, fromCur: string, toCur: string): number | null => {
    if (!amount || !isCrossCurrency) return null
    if (configuredRateType === "manual") {
      if (!configuredManualRate) return null
      if (fromCur === "ARS" && toCur === "USD") {
        return Math.round((amount / configuredManualRate) * 100) / 100
      }
      return Math.round(amount * configuredManualRate * 100) / 100
    }
    if (!ratesMap) return null
    const rateData = ratesMap[configuredRateType]
    if (!rateData) return null
    if (fromCur === "ARS" && toCur === "USD") {
      return Math.round((amount / rateData.sell) * 100) / 100
    }
    return Math.round(amount * rateData.buy * 100) / 100
  }

  // Compute from_amount from to_amount (inverse direction)
  const computeFromAmount = (amount: number, fromCur: string, toCur: string): number | null => {
    if (!amount || !isCrossCurrency) return null
    if (configuredRateType === "manual") {
      if (!configuredManualRate) return null
      // inverse: to_amount in toCur → from_amount in fromCur
      if (fromCur === "ARS" && toCur === "USD") {
        return Math.round(amount * configuredManualRate * 100) / 100
      }
      return Math.round((amount / configuredManualRate) * 100) / 100
    }
    if (!ratesMap) return null
    const rateData = ratesMap[configuredRateType]
    if (!rateData) return null
    if (fromCur === "ARS" && toCur === "USD") {
      return Math.round(amount * rateData.sell * 100) / 100
    }
    return Math.round((amount / rateData.buy) * 100) / 100
  }

  // Update appliedRate whenever relevant inputs change
  useEffect(() => {
    if (!isCrossCurrency) {
      setAppliedRate(null)
      return
    }
    if (configuredRateType === "manual") {
      setAppliedRate(configuredManualRate)
      return
    }
    if (!ratesMap) return
    const rateData = ratesMap[configuredRateType]
    if (!rateData) return
    const fromCur = fromAccount?.currency
    const toCur = toAccount?.currency
    if (fromCur === "ARS" && toCur === "USD") {
      setAppliedRate(rateData.sell)
    } else if (fromCur === "USD" && toCur === "ARS") {
      setAppliedRate(rateData.buy)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrossCurrency, configuredRateType, configuredManualRate, ratesMap, fromAccountId, toAccountId])

  // When accounts change (currency switch), re-seed the non-edited field from scratch
  useEffect(() => {
    if (!isCrossCurrency) {
      setValue("to_amount", fromAmount || 0)
      return
    }
    if (!autoComplete) return
    const fromCur = fromAccount?.currency
    const toCur = toAccount?.currency
    if (!fromCur || !toCur) return
    // Always drive from → to on account change (sensible default)
    lastEdited.current = "from"
    if (!fromAmount) return
    const computed = computeToAmount(fromAmount, fromCur, toCur)
    if (computed !== null) setValue("to_amount", computed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAccountId, toAccountId, isCrossCurrency, autoComplete])

  // Sync same-currency: to always mirrors from
  useEffect(() => {
    if (!isCrossCurrency) {
      setValue("to_amount", fromAmount || 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, isCrossCurrency])

  // Cross-currency: recompute the OTHER field when rate data changes (e.g. rate type switch)
  useEffect(() => {
    if (!isCrossCurrency || !autoComplete) return
    const fromCur = fromAccount?.currency
    const toCur = toAccount?.currency
    if (!fromCur || !toCur) return
    if (lastEdited.current === "from") {
      if (!fromAmount) return
      const computed = computeToAmount(fromAmount, fromCur, toCur)
      if (computed !== null) setValue("to_amount", computed)
    } else {
      if (!toAmount) return
      const computed = computeFromAmount(toAmount, fromCur, toCur)
      if (computed !== null) setValue("from_amount", computed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredRateType, configuredManualRate, ratesMap, autoComplete])

  // Compute implied effective rate from what the user actually typed
  const effectiveRate = (() => {
    if (!isCrossCurrency || !fromAmount || !toAmount) return null
    const fromCurrency = fromAccount?.currency
    const toCurrency = toAccount?.currency
    if (fromCurrency === "ARS" && toCurrency === "USD") {
      return toAmount > 0 ? fromAmount / toAmount : null
    } else if (fromCurrency === "USD" && toCurrency === "ARS") {
      return fromAmount > 0 ? toAmount / fromAmount : null
    }
    return null
  })()

  // ── Attachment state ──────────────────────────────────────────────────────────
  const [pendingComprobante, setPendingComprobante] = useState<File | null>(null)

  // Edit mode: load existing attachment
  const { data: existingAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["transfer_attachments", transferId],
    queryFn: async () => {
      if (!transferId) return []
      const { data } = await listTransferAttachments(transferId)
      return data
    },
    enabled: !!transferId,
  })
  const existingComprobante: MovementAttachment | undefined = existingAttachments[0]

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleFormSubmit = handleSubmit(async (values) => {
    await onSubmit(
      { ...values, is_future: isFutureDate(values.date) },
      pendingComprobante
    )
  })


  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {/* 5.3 — Date FIRST, using MangoDatePicker */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">Fecha</Label>
        <MangoDatePicker
          value={dateStr ? parseISO(dateStr) : null}
          onChange={(d) => {
            setValue("date", d.toISOString().split("T")[0], { shouldValidate: true })
          }}
          placeholder="Seleccioná una fecha"
          aria-invalid={!!errors.date}
        />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* 5.3 — From account with icon + showSearch, separate row */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">Cuenta origen</Label>
        <MangoSelect
          value={fromAccountId}
          onChange={(v) => v && setValue("from_account_id", v, { shouldValidate: true })}
          options={transferAccounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
            leading: <AccountIconChip icon={a.icon} />,
            disabled: a.id === toAccountId,
          }))}
          placeholder="Seleccioná cuenta origen"
          showSearch
          aria-invalid={!!errors.from_account_id}
        />
        {errors.from_account_id && (
          <p className="text-xs text-destructive">{errors.from_account_id.message}</p>
        )}
      </div>

      {/* 5.3 + 5.4 — To account with icon + showSearch; same account disabled */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">Cuenta destino</Label>
        <MangoSelect
          value={toAccountId}
          onChange={(v) => v && setValue("to_account_id", v, { shouldValidate: true })}
          options={transferAccounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
            leading: <AccountIconChip icon={a.icon} />,
            disabled: a.id === fromAccountId,
          }))}
          placeholder="Seleccioná cuenta destino"
          showSearch
          aria-invalid={!!errors.to_account_id}
        />
        {errors.to_account_id && (
          <p className="text-xs text-destructive">{errors.to_account_id.message}</p>
        )}
      </div>

      {/* Amounts */}
      {isCrossCurrency ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Transferencia entre cuentas de distinta moneda —{" "}
              <strong className="text-foreground">{fromAccount?.currency}</strong> →{" "}
              <strong className="text-foreground">{toAccount?.currency}</strong>
            </p>
            <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0 ml-3">
              <Switch
                id="auto-complete-toggle"
                checked={autoComplete}
                onCheckedChange={setAutoComplete}
                aria-label="Autocompletar con la cotización"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Autocompletar
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="from_amount" className="text-xs text-muted-foreground font-medium">
                Monto en {fromAccount?.currency} saliente
              </Label>
              <MoneyInput
                id="from_amount"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                currency={fromAccount?.currency as "ARS" | "USD" | undefined}
                className="tabular-nums w-full"
                value={fromAmount || ""}
                onBlur={register("from_amount").onBlur}
                name={register("from_amount").name}
                ref={register("from_amount").ref}
                onChange={(e) => {
                  lastEdited.current = "from"
                  const raw = parseFloat(e.target.value)
                  const next = isNaN(raw) ? 0 : raw
                  setValue("from_amount", next, { shouldValidate: true })
                  if (!autoComplete) return
                  const fromCur = fromAccount?.currency
                  const toCur = toAccount?.currency
                  if (!fromCur || !toCur || !next) return
                  const computed = computeToAmount(next, fromCur, toCur)
                  if (computed !== null) setValue("to_amount", computed)
                }}
                aria-invalid={!!errors.from_amount}
              />
              {errors.from_amount && (
                <p className="text-xs text-destructive">{errors.from_amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="to_amount" className="text-xs text-muted-foreground font-medium">
                Monto en {toAccount?.currency} entrante
              </Label>
              <MoneyInput
                id="to_amount"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                currency={toAccount?.currency as "ARS" | "USD" | undefined}
                className="tabular-nums w-full"
                value={toAmount || ""}
                onBlur={register("to_amount").onBlur}
                name={register("to_amount").name}
                ref={register("to_amount").ref}
                onChange={(e) => {
                  lastEdited.current = "to"
                  const raw = parseFloat(e.target.value)
                  const next = isNaN(raw) ? 0 : raw
                  setValue("to_amount", next, { shouldValidate: true })
                  if (!autoComplete) return
                  const fromCur = fromAccount?.currency
                  const toCur = toAccount?.currency
                  if (!fromCur || !toCur || !next) return
                  const computed = computeFromAmount(next, fromCur, toCur)
                  if (computed !== null) setValue("from_amount", computed)
                }}
                aria-invalid={!!errors.to_amount}
              />
              {errors.to_amount && (
                <p className="text-xs text-destructive">{errors.to_amount.message}</p>
              )}
            </div>
          </div>

          {/* Rate info */}
          <div className="space-y-0.5">
            {appliedRate !== null ? (
              <p className="text-xs text-muted-foreground">
                Cotización{" "}
                <span className="font-semibold text-foreground">
                  {RATE_LABELS[configuredRateType]}
                </span>
                {": "}
                <span className="tabular-nums font-semibold text-foreground">
                  1 USD = {formatCurrency(appliedRate, "ARS")}
                </span>
                {configuredRateType === "manual" && !configuredManualRate && (
                  <span className="ml-1 text-amber-600">(sin cotización manual configurada)</span>
                )}
              </p>
            ) : configuredRateType === "manual" && !configuredManualRate ? (
              <p className="text-xs text-amber-600">
                No hay cotización manual configurada. Ingresá el monto destino manualmente o{" "}
                configurá una cotización en Ajustes.
              </p>
            ) : null}
            {!autoComplete && effectiveRate !== null && (
              <p className="text-xs text-muted-foreground">
                Tasa implícita:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  1 USD = {formatCurrency(effectiveRate, "ARS")}
                </span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="from_amount" className="text-xs text-muted-foreground font-medium">
            Monto en {fromAccount?.currency}
          </Label>
          <MoneyInput
            id="from_amount"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            currency={fromAccount?.currency as "ARS" | "USD" | undefined}
            className="tabular-nums w-full"
            {...register("from_amount")}
            aria-invalid={!!errors.from_amount}
          />
          {errors.from_amount && (
            <p className="text-xs text-destructive">{errors.from_amount.message}</p>
          )}
        </div>
      )}

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="note" className="text-xs text-muted-foreground font-medium">
          Nota (opcional)
        </Label>
        <Input
          id="note"
          placeholder="Ej: ahorro mensual, cambio de dólares…"
          {...register("note")}
          maxLength={200}
        />
      </div>

      {/* Attachment */}
      <AttachmentSlot
        label="Comprobante"
        existingAttachment={existingComprobante ?? null}
        pendingFile={pendingComprobante}
        onSelect={(file) => setPendingComprobante(file)}
        onClearPending={() => setPendingComprobante(null)}
        onDeleted={() => {
          onAttachmentDeleted?.()
          refetchAttachments()
        }}
        disabled={isLoading}
      />

      <Button type="submit" className="w-full press-effect font-semibold h-11" disabled={isLoading}>
        {isLoading ? "Guardando…" : submitLabel}
      </Button>
    </form>
  )
}

/** Convert a DB transfer row to form default values */
export function transferToFormValues(
  transfer: Tables<"transfers">
): TransferFormValues {
  return {
    from_account_id: transfer.from_account_id,
    to_account_id: transfer.to_account_id,
    from_amount: transfer.from_amount,
    to_amount: transfer.to_amount,
    date: transfer.date,
    note: transfer.note ?? "",
    is_future: transfer.is_future,
  }
}
