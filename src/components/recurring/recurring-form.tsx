"use client"

import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { parseISO, startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MangoSelect } from "@/components/ui/mango-select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { fetchDolarRates } from "@/lib/rates/dolar"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  computeNextRun,
  frequencyLabel,
  FREQUENCY_LABELS,
  WEEKEND_HANDLING_LABELS,
  DAY_OF_WEEK_LABELS,
  MONTH_OF_YEAR_LABELS,
  type RecurringTransaction,
} from "@/lib/recurring"
import type { Enums } from "@/lib/database.types"

type Category = Tables<"categories">
type TxnKind = Enums<"txn_kind">
type RecurringFrequency = Enums<"recurring_frequency">
type WeekendHandling = Enums<"weekend_handling">

// ── Schema ────────────────────────────────────────────────────────────────────

export type RecurringFormValues = {
  kind: TxnKind
  amount: number
  currency: "ARS" | "USD"
  account_id: string
  to_account_id: string | null
  to_amount: number | null
  category_id: string | null
  note: string
  frequency: RecurringFrequency
  day_of_week: number | null
  day_of_month: number | null
  month_of_year: number | null
  weekend_handling: WeekendHandling
  start_date: string
  end_date: string | null
  is_card_recurring: boolean
}

const schema = z
  .object({
    kind: z.enum(["income", "expense", "transfer"]),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    currency: z.enum(["ARS", "USD"]),
    account_id: z.string().min(1, "Seleccioná una cuenta"),
    to_account_id: z.string().nullable(),
    to_amount: z.coerce.number().nullable(),
    category_id: z.string().nullable(),
    note: z.string(),
    frequency: z.enum(["weekly", "biweekly", "monthly", "bimonthly", "annual"]),
    day_of_week: z.coerce.number().nullable(),
    day_of_month: z.coerce.number().nullable(),
    month_of_year: z.coerce.number().nullable(),
    weekend_handling: z.enum(["as_is", "skip", "previous_business_day"]),
    start_date: z.string().min(1, "Seleccioná una fecha de inicio"),
    end_date: z.string().nullable(),
    is_card_recurring: z.boolean(),
  })
  .refine(
    (v) => v.kind !== "transfer" || (v.to_account_id && v.to_account_id !== v.account_id),
    { message: "La cuenta destino debe ser distinta", path: ["to_account_id"] }
  )
  .refine(
    (v) => v.kind !== "transfer" || (v.to_amount !== null && v.to_amount > 0),
    { message: "Ingresá el monto destino", path: ["to_amount"] }
  )

interface RecurringFormProps {
  accounts: Account[]
  categories: Category[]
  defaultValues?: Partial<RecurringFormValues>
  onSubmit: (values: RecurringFormValues) => Promise<void>
  onDelete?: () => Promise<void>
  isLoading?: boolean
  isDeleting?: boolean
  submitLabel?: string
}

export function RecurringForm({
  accounts,
  categories,
  defaultValues,
  onSubmit,
  onDelete,
  isLoading,
  isDeleting,
  submitLabel = "Guardar recurrente",
}: RecurringFormProps) {
  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RecurringFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as unknown as Resolver<RecurringFormValues, any>,
    defaultValues: {
      kind: "expense",
      amount: 0,
      currency: "ARS",
      account_id: accounts[0]?.id ?? "",
      to_account_id: null,
      to_amount: null,
      category_id: null,
      note: "",
      frequency: "monthly",
      day_of_week: 1,
      day_of_month: 1,
      month_of_year: 1,
      weekend_handling: "as_is",
      start_date: today,
      end_date: null,
      is_card_recurring: false,
      ...defaultValues,
    },
  })

  const kind = watch("kind")
  const amount = watch("amount")
  const currency = watch("currency")
  const accountId = watch("account_id")
  const toAccountId = watch("to_account_id")
  const toAmount = watch("to_amount")
  const frequency = watch("frequency")
  const startDate = watch("start_date")
  const endDate = watch("end_date")
  const weekendHandling = watch("weekend_handling")
  const dayOfWeek = watch("day_of_week")
  const dayOfMonth = watch("day_of_month")
  const monthOfYear = watch("month_of_year")
  const isCardRecurring = watch("is_card_recurring")

  const fromAccount = accounts.find((a) => a.id === accountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isTransfer = kind === "transfer"
  const isCrossCurrency =
    isTransfer && !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency

  // Auto-set to_amount = amount for same-currency transfers
  useEffect(() => {
    if (isTransfer && fromAccount && toAccount && fromAccount.currency === toAccount.currency) {
      setValue("to_amount", amount || 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransfer, accountId, toAccountId, amount])

  // Live implied rate for cross-currency transfers
  const [impliedRate, setImpliedRate] = useState<number | null>(null)
  useEffect(() => {
    if (!isCrossCurrency) { setImpliedRate(null); return }
    let cancelled = false
    fetchDolarRates().then((rates) => {
      if (cancelled) return
      const data = rates["blue"]
      if (!data) return
      const fc = fromAccount?.currency
      const tc = toAccount?.currency
      if (fc === "ARS" && tc === "USD") setImpliedRate(data.sell)
      else if (fc === "USD" && tc === "ARS") setImpliedRate(data.buy)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrossCurrency, accountId, toAccountId])

  // Effective rate display
  const effectiveRate = (() => {
    if (!isCrossCurrency || !amount || !toAmount) return null
    const fc = fromAccount?.currency
    const tc = toAccount?.currency
    if (fc === "ARS" && tc === "USD") return toAmount > 0 ? amount / toAmount : null
    if (fc === "USD" && tc === "ARS") return amount > 0 ? toAmount / amount : null
    return null
  })()

  // Preview next_run based on current form values
  const previewNextRun = (() => {
    if (!startDate) return null
    try {
      const fakeRec = {
        frequency,
        day_of_week: dayOfWeek,
        day_of_month: dayOfMonth,
        month_of_year: monthOfYear,
        weekend_handling: weekendHandling,
        start_date: startDate,
      } as RecurringTransaction
      const from = startOfDay(parseISO(startDate))
      const next = computeNextRun(fakeRec, from)
      return next.toISOString().split("T")[0]
    } catch {
      return null
    }
  })()

  const filteredCategories = categories.filter((c) =>
    kind === "income" ? c.type === "income" : c.type === "expense"
  )

  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly"
  const showDayOfMonth =
    frequency === "monthly" || frequency === "bimonthly" || frequency === "annual"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Kind toggle */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {(["expense", "income", "transfer"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setValue("kind", k, { shouldValidate: true })
              setValue("category_id", null)
              if (k !== "transfer") {
                setValue("to_account_id", null)
                setValue("to_amount", null)
              }
            }}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer press-effect",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              kind === k
                ? k === "income"
                  ? "bg-success text-white shadow-sm"
                  : k === "expense"
                  ? "bg-destructive text-white shadow-sm"
                  : "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {k === "income" ? "Ingreso" : k === "expense" ? "Gasto" : "Transferencia"}
          </button>
        ))}
      </div>

      {/* Amount + currency */}
      <div className="space-y-1.5">
        <Label htmlFor="amount" className="text-xs text-muted-foreground font-medium">
          Monto
        </Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground select-none">
            $
          </span>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            placeholder="0"
            className={cn(
              "pl-9 text-2xl font-bold tabular-nums h-14 rounded-xl border-border/60",
              "focus:border-primary focus:ring-2 focus:ring-ring/30"
            )}
            {...register("amount")}
            aria-invalid={!!errors.amount}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <MangoSelect
              value={currency}
              onChange={(v) => setValue("currency", v as "ARS" | "USD", { shouldValidate: true })}
              options={[
                { value: "ARS", label: "ARS", leading: <span className="text-sm" aria-hidden>🇦🇷</span> },
                { value: "USD", label: "US$", leading: <span className="text-sm" aria-hidden>🇺🇸</span> },
              ]}
              className="w-28"
              triggerClassName="h-8 text-xs font-bold border-border/60 bg-muted/50"
              aria-label="Moneda"
            />
          </div>
        </div>
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      {/* Account */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">
          {isTransfer ? "Cuenta origen" : "Cuenta"}
        </Label>
        <MangoSelect
          value={accountId}
          onChange={(v) => v && setValue("account_id", v, { shouldValidate: true })}
          options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
          placeholder="Seleccioná cuenta"
          aria-invalid={!!errors.account_id}
        />
        {errors.account_id && (
          <p className="text-xs text-destructive">{errors.account_id.message}</p>
        )}
      </div>

      {/* Transfer: destination account + cross-currency */}
      {isTransfer && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Cuenta destino</Label>
            <MangoSelect
              value={toAccountId ?? ""}
              onChange={(v) => v && setValue("to_account_id", v, { shouldValidate: true })}
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.currency})`,
                disabled: a.id === accountId,
              }))}
              placeholder="Seleccioná cuenta destino"
              aria-invalid={!!errors.to_account_id}
            />
            {errors.to_account_id && (
              <p className="text-xs text-destructive">{errors.to_account_id.message}</p>
            )}
          </div>

          {isCrossCurrency && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Transferencia entre monedas —{" "}
                <strong className="text-foreground">{fromAccount?.currency}</strong> →{" "}
                <strong className="text-foreground">{toAccount?.currency}</strong>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="to_amount" className="text-xs text-muted-foreground font-medium">
                  Monto en {toAccount?.currency}
                </Label>
                <Input
                  id="to_amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0,00"
                  className="tabular-nums"
                  value={toAmount ?? ""}
                  onChange={(e) =>
                    setValue("to_amount", e.target.value ? parseFloat(e.target.value) : null)
                  }
                />
                {errors.to_amount && (
                  <p className="text-xs text-destructive">{errors.to_amount.message}</p>
                )}
                {effectiveRate !== null && (
                  <p className="text-xs text-muted-foreground">
                    Tasa implícita:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      1 USD = {formatCurrency(effectiveRate, "ARS")}
                    </span>
                    {impliedRate && (
                      <span className="ml-1">(blue: {formatCurrency(impliedRate, "ARS")})</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {!isCrossCurrency && (
            <div className="space-y-1.5">
              <Label htmlFor="to_amount" className="text-xs text-muted-foreground font-medium">
                Monto destino
              </Label>
              <Input
                id="to_amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                className="tabular-nums"
                value={toAmount ?? ""}
                onChange={(e) =>
                  setValue("to_amount", e.target.value ? parseFloat(e.target.value) : null)
                }
              />
            </div>
          )}
        </>
      )}

      {/* Category — only for income/expense */}
      {!isTransfer && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Categoría</Label>
          <MangoSelect
            value={watch("category_id") ?? "none"}
            onChange={(v) => setValue("category_id", v === "none" ? null : v)}
            options={[
              { value: "none", label: "Sin categoría" },
              ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            placeholder="Sin categoría"
          />
        </div>
      )}

      {/* Frequency */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">Frecuencia</Label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(FREQUENCY_LABELS) as [RecurringFrequency, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setValue("frequency", key, { shouldValidate: true })}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  frequency === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
                )}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Day of week for weekly/biweekly */}
      {showDayOfWeek && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Día de la semana</Label>
          <MangoSelect
            value={String(dayOfWeek ?? 1)}
            onChange={(v) => v != null && setValue("day_of_week", parseInt(v))}
            options={Object.entries(DAY_OF_WEEK_LABELS).map(([k, label]) => ({ value: k, label }))}
            aria-label="Día de la semana"
          />
        </div>
      )}

      {/* Day of month for monthly/bimonthly/annual */}
      {showDayOfMonth && (
        <div className={cn("gap-3", frequency === "annual" ? "grid grid-cols-2" : "space-y-1.5")}>
          {frequency === "annual" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Mes</Label>
              <MangoSelect
                value={String(monthOfYear ?? 1)}
                onChange={(v) => v != null && setValue("month_of_year", parseInt(v))}
                options={Object.entries(MONTH_OF_YEAR_LABELS).map(([k, label]) => ({ value: k, label }))}
                aria-label="Mes del año"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="day_of_month" className="text-xs text-muted-foreground font-medium">
              Día del mes
            </Label>
            <Input
              id="day_of_month"
              type="number"
              min="1"
              max="31"
              inputMode="numeric"
              placeholder="1"
              {...register("day_of_month")}
            />
          </div>
        </div>
      )}

      {/* Weekend handling */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">
          Si cae en fin de semana
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {(
            Object.entries(WEEKEND_HANDLING_LABELS) as [WeekendHandling, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setValue("weekend_handling", key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                weekendHandling === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Vigencia */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start_date" className="text-xs text-muted-foreground font-medium">
            Vigencia desde
          </Label>
          <Input
            id="start_date"
            type="date"
            {...register("start_date")}
            aria-invalid={!!errors.start_date}
            className="text-sm"
          />
          {errors.start_date && (
            <p className="text-xs text-destructive">{errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_date" className="text-xs text-muted-foreground font-medium">
            Hasta (opcional)
          </Label>
          <Input
            id="end_date"
            type="date"
            value={endDate ?? ""}
            onChange={(e) => setValue("end_date", e.target.value || null)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Card recurring toggle */}
      {(kind === "expense" || kind === "transfer") && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Gasto de tarjeta de crédito</p>
            <p className="text-xs text-muted-foreground">
              Se aplica si pagás con tarjeta y aparece en el resumen
            </p>
          </div>
          <Switch
            checked={isCardRecurring}
            onCheckedChange={(v) => setValue("is_card_recurring", v)}
            aria-label="Gasto recurrente de tarjeta"
          />
        </div>
      )}

      {/* Nota */}
      <div className="space-y-1.5">
        <Label htmlFor="note" className="text-xs text-muted-foreground font-medium">
          Nota (opcional)
        </Label>
        <Input
          id="note"
          placeholder="Ej: Spotify, alquiler, sueldo mensual…"
          {...register("note")}
          maxLength={200}
        />
      </div>

      {/* Preview next run */}
      {previewNextRun && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Primera ejecución:{" "}
            <span className="font-semibold text-foreground tabular-nums">{previewNextRun}</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <Button
          type="submit"
          className="w-full press-effect font-semibold h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
          disabled={isLoading}
        >
          {isLoading ? "Guardando…" : submitLabel}
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="outline"
            className="w-full press-effect text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando…" : "Eliminar recurrente"}
          </Button>
        )}
      </div>
    </form>
  )
}

/** Convert a DB recurring_transaction row to form default values */
export function recurringToFormValues(rec: RecurringTransaction): RecurringFormValues {
  return {
    kind: rec.kind,
    amount: rec.amount,
    currency: rec.currency,
    account_id: rec.account_id ?? "",
    to_account_id: rec.to_account_id ?? null,
    to_amount: rec.to_amount ?? null,
    category_id: rec.category_id ?? null,
    note: rec.note ?? "",
    frequency: rec.frequency,
    day_of_week: rec.day_of_week ?? null,
    day_of_month: rec.day_of_month ?? null,
    month_of_year: rec.month_of_year ?? null,
    weekend_handling: rec.weekend_handling,
    start_date: rec.start_date,
    end_date: rec.end_date ?? null,
    is_card_recurring: rec.is_card_recurring,
  }
}
