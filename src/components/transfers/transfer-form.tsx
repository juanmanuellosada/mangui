"use client"

import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { formatCurrency } from "@/lib/utils"
import { fetchDolarRates } from "@/lib/rates/dolar"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"

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

interface TransferFormProps {
  accounts: Account[]
  defaultValues?: Partial<TransferFormValues>
  onSubmit: (values: TransferFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function TransferForm({
  accounts,
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar",
}: TransferFormProps) {
  const today = new Date().toISOString().split("T")[0]

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
      from_account_id: accounts[0]?.id ?? "",
      to_account_id: accounts[1]?.id ?? accounts[0]?.id ?? "",
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
  const isFuture = watch("is_future")

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isCrossCurrency =
    !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency

  // Auto-suggest to_amount when same currency or on cross-currency rate fetch
  const [impliedRate, setImpliedRate] = useState<number | null>(null)
  const [rateFetched, setRateFetched] = useState(false)

  // When accounts change, reset to_amount and fetch rate for cross-currency
  useEffect(() => {
    if (!isCrossCurrency) {
      // Same currency: keep to_amount in sync with from_amount
      setValue("to_amount", fromAmount || 0)
      setImpliedRate(null)
      setRateFetched(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAccountId, toAccountId, isCrossCurrency])

  // Sync to_amount when from_amount changes and same currency
  useEffect(() => {
    if (!isCrossCurrency) {
      setValue("to_amount", fromAmount || 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount])

  // Fetch blue rate for cross-currency auto-suggest
  useEffect(() => {
    if (!isCrossCurrency || rateFetched) return
    let cancelled = false
    fetchDolarRates().then((rates) => {
      if (cancelled) return
      const rateData = rates["blue"]
      if (!rateData) return
      setRateFetched(true)
      // fromAccount → ARS, toAccount → USD: sell rate (ARS → USD)
      // fromAccount → USD, toAccount → ARS: buy rate (USD → ARS)
      const fromCurrency = fromAccount?.currency
      const toCurrency = toAccount?.currency
      if (fromCurrency === "ARS" && toCurrency === "USD") {
        setImpliedRate(rateData.sell)
        if (!toAmount) {
          setValue("to_amount", Math.round((fromAmount / rateData.sell) * 100) / 100)
        }
      } else if (fromCurrency === "USD" && toCurrency === "ARS") {
        setImpliedRate(rateData.buy)
        if (!toAmount) {
          setValue("to_amount", Math.round(fromAmount * rateData.buy * 100) / 100)
        }
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrossCurrency, fromAccountId, toAccountId])

  // Compute implied effective rate from what the user actually typed
  const effectiveRate = (() => {
    if (!isCrossCurrency || !fromAmount || !toAmount) return null
    const fromCurrency = fromAccount?.currency
    const toCurrency = toAccount?.currency
    if (fromCurrency === "ARS" && toCurrency === "USD") {
      // to_amount is USD, from_amount is ARS: rate = ARS per USD
      return toAmount > 0 ? fromAmount / toAmount : null
    } else if (fromCurrency === "USD" && toCurrency === "ARS") {
      // from_amount is USD, to_amount is ARS: rate = ARS per USD
      return fromAmount > 0 ? toAmount / fromAmount : null
    }
    return null
  })()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* From account */}
      <div className="space-y-1.5">
        <Label>Cuenta origen</Label>
        <MangoSelect
          value={fromAccountId}
          onChange={(v) => v && setValue("from_account_id", v, { shouldValidate: true })}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
          placeholder="Seleccioná cuenta origen"
          aria-invalid={!!errors.from_account_id}
        />
        {errors.from_account_id && (
          <p className="text-xs text-destructive">{errors.from_account_id.message}</p>
        )}
      </div>

      {/* To account */}
      <div className="space-y-1.5">
        <Label>Cuenta destino</Label>
        <MangoSelect
          value={toAccountId}
          onChange={(v) => v && setValue("to_account_id", v, { shouldValidate: true })}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
            disabled: a.id === fromAccountId,
          }))}
          placeholder="Seleccioná cuenta destino"
          aria-invalid={!!errors.to_account_id}
        />
        {errors.to_account_id && (
          <p className="text-xs text-destructive">{errors.to_account_id.message}</p>
        )}
      </div>

      {/* Amounts */}
      {isCrossCurrency ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Transferencia entre cuentas de distinta moneda —{" "}
            <strong className="text-foreground">{fromAccount?.currency}</strong> →{" "}
            <strong className="text-foreground">{toAccount?.currency}</strong>
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="from_amount">
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

            <div className="space-y-1.5">
              <Label htmlFor="to_amount">
                Monto en {toAccount?.currency}
              </Label>
              <MoneyInput
                id="to_amount"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                currency={toAccount?.currency as "ARS" | "USD" | undefined}
                className="tabular-nums w-full"
                {...register("to_amount")}
                aria-invalid={!!errors.to_amount}
              />
              {errors.to_amount && (
                <p className="text-xs text-destructive">{errors.to_amount.message}</p>
              )}
            </div>
          </div>

          {/* Implied rate */}
          {effectiveRate !== null && (
            <p className="text-xs text-muted-foreground">
              Tasa implícita:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                1 USD = {formatCurrency(effectiveRate, "ARS")}
              </span>
              {impliedRate && (
                <span className="ml-1">
                  (blue: {formatCurrency(impliedRate, "ARS")})
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="from_amount">Monto</Label>
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

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          type="date"
          {...register("date")}
          aria-invalid={!!errors.date}
        />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input
          id="note"
          placeholder="Ej: ahorro mensual, cambio de dólares…"
          {...register("note")}
          maxLength={200}
        />
      </div>

      {/* Future toggle */}
      <div className="flex items-center gap-2">
        <input
          id="is_future"
          type="checkbox"
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          checked={isFuture}
          onChange={(e) => setValue("is_future", e.target.checked)}
        />
        <Label htmlFor="is_future" className="cursor-pointer font-normal">
          Transferencia futura (programada)
        </Label>
      </div>

      <Button type="submit" className="w-full press-effect" disabled={isLoading}>
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
