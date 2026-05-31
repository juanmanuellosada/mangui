"use client"

import { useState, useEffect } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { computeInstallmentAmounts } from "@/lib/installments"
import { DOLLAR_TYPE_LABELS, type DollarType } from "@/lib/movements"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"

type Category = Tables<"categories">

// ── Schema ────────────────────────────────────────────────────────────────────

export type InstallmentFormValues = {
  description: string
  total_amount: number
  installments_count: number
  start_date: string
  account_id: string
  category_id: string | null
  currency: "ARS" | "USD"
  dollar_type: DollarType | null
}

const schema = z.object({
  description: z.string().min(1, "Ingresá una descripción"),
  total_amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  installments_count: z.coerce.number().int().min(2, "Mínimo 2 cuotas").max(60, "Máximo 60 cuotas"),
  start_date: z.string().min(1, "Seleccioná una fecha"),
  account_id: z.string().min(1, "Seleccioná una cuenta"),
  category_id: z.string().nullable(),
  currency: z.enum(["ARS", "USD"]),
  dollar_type: z.enum(["oficial", "blue", "mep", "ccl", "tarjeta"]).nullable(),
})

const PRESET_INSTALLMENTS = [3, 6, 12] as const

interface InstallmentFormProps {
  accounts: Account[]
  categories: Category[]
  onSubmit: (values: InstallmentFormValues) => Promise<void>
  isLoading?: boolean
}

export function InstallmentForm({
  accounts,
  categories,
  onSubmit,
  isLoading,
}: InstallmentFormProps) {
  const today = new Date().toISOString().split("T")[0]

  // Default to first credit-card account if any, otherwise first account
  const defaultAccount =
    accounts.find((a) => a.type === "tarjeta_credito") ?? accounts[0]

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InstallmentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as unknown as Resolver<InstallmentFormValues, any>,
    defaultValues: {
      description: "",
      total_amount: 0,
      installments_count: 3,
      start_date: today,
      account_id: defaultAccount?.id ?? "",
      category_id: null,
      currency: defaultAccount?.currency ?? "ARS",
      dollar_type: null,
    },
  })

  const total = watch("total_amount")
  const count = watch("installments_count")
  const currency = watch("currency")
  const accountId = watch("account_id")
  const dollarType = watch("dollar_type")
  const [customCount, setCustomCount] = useState("")
  const [liveRate, setLiveRate] = useState<number | null>(null)

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const accountCurrency = selectedAccount?.currency ?? "ARS"
  const isCrossCurrency = currency !== accountCurrency

  // Expense categories only
  const expenseCategories = categories.filter((c) => c.type === "expense")

  // Live rate for cross-currency preview
  useEffect(() => {
    if (!isCrossCurrency || !dollarType) {
      setLiveRate(null)
      return
    }
    let cancelled = false
    fetchDolarRates().then((rates) => {
      if (cancelled) return
      const data = rates[dollarType as Exclude<DollarType, "tarjeta">]
      if (data) {
        const rate = currency === "ARS" ? data.sell : data.buy
        setLiveRate(rate)
      }
    })
    return () => { cancelled = true }
  }, [isCrossCurrency, dollarType, currency])

  // Compute installment preview
  const safeCount = Number.isInteger(count) && count >= 2 ? count : 0
  const safeTotal = total > 0 ? total : 0
  const { perAmount, lastAmount } =
    safeCount >= 2 && safeTotal > 0
      ? computeInstallmentAmounts(safeTotal, safeCount)
      : { perAmount: 0, lastAmount: 0 }

  const firstInstallmentDate = watch("start_date")
  const lastInstallmentDate = (() => {
    if (!firstInstallmentDate || safeCount < 2) return ""
    const d = new Date(firstInstallmentDate)
    d.setMonth(d.getMonth() + safeCount - 1)
    return d.toISOString().split("T")[0]
  })()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs text-muted-foreground font-medium">
          Descripción
        </Label>
        <Input
          id="description"
          placeholder="Ej: Smart TV Samsung 55&quot;"
          {...register("description")}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Total amount */}
      <div className="space-y-1.5">
        <Label htmlFor="total_amount" className="text-xs text-muted-foreground font-medium">
          Monto total
        </Label>
        <MoneyInput
          id="total_amount"
          step="0.01"
          min="0.01"
          placeholder="0"
          currency={currency}
          className={cn(
            "text-2xl font-bold tabular-nums h-14 rounded-xl border-border/60",
            "focus:border-primary focus:ring-2 focus:ring-ring/30"
          )}
          wrapperClassName="w-full"
          {...register("total_amount")}
          aria-invalid={!!errors.total_amount}
        />
        {errors.total_amount && (
          <p className="text-xs text-destructive">{errors.total_amount.message}</p>
        )}
      </div>

      {/* Currency toggle — segmented ARS / USD */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">Moneda</Label>
        <CurrencyToggle
          value={currency}
          onChange={(v) => {
            setValue("currency", v, { shouldValidate: true })
            setValue("dollar_type", null)
          }}
          className="w-full"
        />
      </div>

      {/* Installments count */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium">
          Cantidad de cuotas
        </Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_INSTALLMENTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setValue("installments_count", n, { shouldValidate: true })
                setCustomCount("")
              }}
              className={cn(
                "h-10 w-12 rounded-xl text-sm font-bold border transition-all duration-150 cursor-pointer press-effect",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                count === n && customCount === ""
                  ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                  : "bg-muted text-muted-foreground border-transparent hover:border-primary/40 hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
          <div className="flex-1 min-w-[5rem]">
            <Input
              type="number"
              min={2}
              max={60}
              inputMode="numeric"
              placeholder="Otro"
              value={customCount}
              onChange={(e) => {
                const v = e.target.value
                setCustomCount(v)
                const n = parseInt(v, 10)
                if (!isNaN(n) && n >= 2 && n <= 60) {
                  setValue("installments_count", n, { shouldValidate: true })
                }
              }}
              className={cn(
                "text-sm font-bold tabular-nums text-center",
                customCount !== "" && "border-primary ring-1 ring-ring/30"
              )}
            />
          </div>
        </div>
        {errors.installments_count && (
          <p className="text-xs text-destructive">{errors.installments_count.message}</p>
        )}
      </div>

      {/* Account + Category */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Cuenta</Label>
          <MangoSelect
            value={accountId}
            onChange={(v) => v && setValue("account_id", v, { shouldValidate: true })}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Cuenta"
            aria-invalid={!!errors.account_id}
          />
          {errors.account_id && (
            <p className="text-xs text-destructive">{errors.account_id.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Categoría</Label>
          <MangoSelect
            value={watch("category_id") ?? "none"}
            onChange={(v) => setValue("category_id", v === "none" ? null : v)}
            options={[
              { value: "none", label: "Sin categoría" },
              ...expenseCategories.map((c) => ({
                value: c.id,
                label: c.name,
                leading: c.icon ? (
                  <span className="text-base leading-none select-none" aria-hidden>
                    {c.icon}
                  </span>
                ) : undefined,
              })),
            ]}
            placeholder="Categoría"
          />
        </div>
      </div>

      {/* Start date */}
      <div className="space-y-1.5">
        <Label htmlFor="start_date" className="text-xs text-muted-foreground font-medium">
          Fecha primera cuota
        </Label>
        <Input
          id="start_date"
          type="date"
          {...register("start_date")}
          className="text-sm"
          aria-invalid={!!errors.start_date}
        />
        {errors.start_date && (
          <p className="text-xs text-destructive">{errors.start_date.message}</p>
        )}
      </div>

      {/* Cross-currency section */}
      {isCrossCurrency && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            La cuenta está en{" "}
            <strong className="text-foreground">{accountCurrency}</strong>, la compra
            es en{" "}
            <strong className="text-foreground">{currency}</strong> — seleccioná el tipo de cambio:
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Tipo de dólar</Label>
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
            {liveRate && (
              <p className="text-[11px] text-muted-foreground">
                Tipo de cambio referencia:{" "}
                <span className="tabular-nums font-semibold">{formatCurrency(liveRate, "ARS")}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Live preview */}
      {safeCount >= 2 && safeTotal > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
          <p
            className="text-base font-bold tabular-nums text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {safeCount} cuotas de{" "}
            <span className="text-primary">{formatCurrency(perAmount, currency)}</span>
          </p>
          {lastAmount !== perAmount && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Última cuota: {formatCurrency(lastAmount, currency)}
            </p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            Total: {formatCurrency(safeTotal, currency)}
          </p>
          {firstInstallmentDate && lastInstallmentDate && (
            <p className="text-[11px] text-muted-foreground">
              Primera: {firstInstallmentDate} · Última: {lastInstallmentDate}
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full press-effect font-semibold h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
        disabled={isLoading}
      >
        {isLoading ? "Guardando…" : "Guardar en cuotas"}
      </Button>
    </form>
  )
}
