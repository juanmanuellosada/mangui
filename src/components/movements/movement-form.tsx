"use client"

import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { fetchDolarRates } from "@/lib/rates/dolar"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import { DOLLAR_TYPE_LABELS, type DollarType } from "@/lib/movements"

type Category = Tables<"categories">

// ── Form schema ──────────────────────────────────────────────────────────────

export type MovementFormValues = {
  type: "income" | "expense"
  amount: number
  original_currency: "ARS" | "USD"
  account_id: string
  category_id: string | null
  date: string
  note: string
  is_future: boolean
  // cross-currency
  dollar_type: DollarType | null
  converted_amount: number | null
}

const movementSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  original_currency: z.enum(["ARS", "USD"]),
  account_id: z.string().min(1, "Seleccioná una cuenta"),
  category_id: z.string().nullable(),
  date: z.string().min(1, "Seleccioná una fecha"),
  note: z.string(),
  is_future: z.boolean(),
  dollar_type: z
    .enum(["oficial", "blue", "mep", "ccl", "tarjeta"])
    .nullable(),
  converted_amount: z.coerce.number().nullable(),
})

interface MovementFormProps {
  accounts: Account[]
  categories: Category[]
  defaultValues?: Partial<MovementFormValues>
  onSubmit: (values: MovementFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function MovementForm({
  accounts,
  categories,
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar",
}: MovementFormProps) {
  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MovementFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(movementSchema) as unknown as Resolver<MovementFormValues, any>,
    defaultValues: {
      type: "expense",
      amount: 0,
      original_currency: "ARS",
      account_id: accounts[0]?.id ?? "",
      category_id: null,
      date: today,
      note: "",
      is_future: false,
      dollar_type: null,
      converted_amount: null,
      ...defaultValues,
    },
  })

  const type = watch("type")
  const amount = watch("amount")
  const originalCurrency = watch("original_currency")
  const accountId = watch("account_id")
  const dollarType = watch("dollar_type")
  const convertedAmount = watch("converted_amount")
  const isFuture = watch("is_future")

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const accountCurrency = selectedAccount?.currency ?? "ARS"
  const isCrossCurrency = !!originalCurrency && !!accountCurrency && originalCurrency !== accountCurrency

  // Auto-set currency to account's currency when account changes
  useEffect(() => {
    if (selectedAccount && !defaultValues?.original_currency) {
      setValue("original_currency", selectedAccount.currency)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  // Live rate preview for cross-currency
  const [liveRate, setLiveRate] = useState<number | null>(null)
  useEffect(() => {
    if (!isCrossCurrency || !dollarType || dollarType === null) {
      setLiveRate(null)
      return
    }
    let cancelled = false
    fetchDolarRates().then((rates) => {
      if (cancelled) return
      const data = rates[dollarType as Exclude<DollarType, "tarjeta">]
      if (data) {
        // Use sell rate when ARS→USD, buy rate when USD→ARS
        const rate = originalCurrency === "ARS" ? data.sell : data.buy
        setLiveRate(rate)
        // Auto-fill converted amount if not manually edited
        if (!convertedAmount) {
          const converted = originalCurrency === "ARS"
            ? amount / rate
            : amount * rate
          setValue("converted_amount", Math.round(converted * 100) / 100)
        }
      }
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrossCurrency, dollarType, amount, originalCurrency])

  // Filtered categories by movement type
  const filteredCategories = categories.filter((c) => c.type === type)

  // Compute live conversion preview
  const previewConverted = (() => {
    if (!isCrossCurrency) return null
    if (convertedAmount) return convertedAmount
    if (!liveRate || !amount) return null
    return originalCurrency === "ARS"
      ? amount / liveRate
      : amount * liveRate
  })()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type toggle */}
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setValue("type", t, { shouldValidate: true })
                setValue("category_id", null)
              }}
              className={cn(
                "h-10 rounded-xl text-sm font-semibold border transition-all duration-150 cursor-pointer press-effect",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                type === t && t === "income"
                  ? "bg-success/15 border-success/40 text-success"
                  : type === t && t === "expense"
                  ? "bg-destructive/10 border-destructive/40 text-destructive"
                  : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {t === "income" ? "+ Ingreso" : "− Gasto"}
            </button>
          ))}
        </div>
      </div>

      {/* Account */}
      <div className="space-y-1.5">
        <Label>Cuenta</Label>
        <Select
          value={accountId}
          onValueChange={(v) => v && setValue("account_id", v, { shouldValidate: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccioná una cuenta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                <span className="ml-1.5 text-[10px] text-muted-foreground uppercase">
                  {a.currency}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.account_id && (
          <p className="text-xs text-destructive">{errors.account_id.message}</p>
        )}
      </div>

      {/* Amount + currency row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            placeholder="0,00"
            className="tabular-nums"
            {...register("amount")}
            aria-invalid={!!errors.amount}
          />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Select
            value={originalCurrency}
            onValueChange={(v) => {
              setValue("original_currency", v as "ARS" | "USD", { shouldValidate: true })
              setValue("converted_amount", null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cross-currency section */}
      {isCrossCurrency && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            La cuenta está en{" "}
            <strong className="text-foreground">{accountCurrency}</strong> pero el movimiento
            es en{" "}
            <strong className="text-foreground">{originalCurrency}</strong> — seleccioná el tipo
            de cambio:
          </p>

          {/* Dollar type picker */}
          <div className="space-y-1.5">
            <Label>Tipo de dólar</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(DOLLAR_TYPE_LABELS) as [DollarType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setValue("dollar_type", key, { shouldValidate: true })}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dollarType === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Converted amount field */}
          <div className="space-y-1.5">
            <Label htmlFor="converted_amount">
              Monto en {accountCurrency}{" "}
              {liveRate && (
                <span className="text-muted-foreground font-normal">
                  (tipo: {formatCurrency(liveRate, "ARS").replace("$", "").trim()})
                </span>
              )}
            </Label>
            <Input
              id="converted_amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0,00"
              className="tabular-nums"
              value={convertedAmount ?? ""}
              onChange={(e) =>
                setValue("converted_amount", e.target.value ? parseFloat(e.target.value) : null)
              }
            />
            {previewConverted !== null && !convertedAmount && (
              <p className="text-xs text-muted-foreground">
                ≈{" "}
                <span className="tabular-nums font-semibold">
                  {formatCurrency(previewConverted, accountCurrency)}
                </span>{" "}
                al dólar {DOLLAR_TYPE_LABELS[dollarType ?? "blue"]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Categoría</Label>
        <Select
          value={watch("category_id") ?? "none"}
          onValueChange={(v) => setValue("category_id", v === "none" ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin categoría</SelectItem>
            {filteredCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input
          id="note"
          placeholder="Ej: supermercado, pago de sueldo…"
          {...register("note")}
          maxLength={200}
        />
      </div>

      {/* Future movement toggle */}
      <div className="flex items-center gap-2">
        <input
          id="is_future"
          type="checkbox"
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          checked={isFuture}
          onChange={(e) => setValue("is_future", e.target.checked)}
        />
        <Label htmlFor="is_future" className="cursor-pointer font-normal">
          Movimiento futuro (programado)
        </Label>
      </div>

      <Button type="submit" className="w-full press-effect" disabled={isLoading}>
        {isLoading ? "Guardando…" : submitLabel}
      </Button>
    </form>
  )
}

/** Convert a DB movement row to form default values */
export function movementToFormValues(
  movement: Tables<"movements">
): MovementFormValues {
  return {
    type: movement.type,
    amount: movement.amount,
    original_currency: movement.original_currency,
    account_id: movement.account_id,
    category_id: movement.category_id,
    date: movement.date,
    note: movement.note ?? "",
    is_future: movement.is_future,
    dollar_type: (movement.dollar_type as DollarType | null) ?? null,
    converted_amount: movement.converted_amount ?? null,
  }
}
