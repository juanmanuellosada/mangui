"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, parseISO } from "date-fns"
import { X, TrendingDown, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Switch } from "@/components/ui/switch"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { IconPicker } from "@/components/ui/icon-picker"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip, renderCategoryIcon } from "@/lib/categories"
import { cn, formatCurrency } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import {
  periodLabel,
  computeBudgetProgress,
  calendarPeriodWindow,
  type Budget,
  type BudgetPeriod,
} from "@/lib/budgets"
import type { Tables } from "@/lib/database.types"

type Category = Tables<"categories">
type Account = Tables<"accounts">
type Movement = Tables<"movements">

// ── Schema ────────────────────────────────────────────────────────────────────

export type BudgetFormValues = {
  name: string
  icon: string
  limit_amount: number
  currency: "ARS" | "USD"
  period: BudgetPeriod | null
  start_date: string
  end_date: string
  category_ids: string[]
  account_ids: string[]
  is_recurring: boolean
  rollover_enabled: boolean
  alert_threshold: number
}

const budgetBaseSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  icon: z.string().optional(),
  limit_amount: z.coerce.number().positive("El límite debe ser mayor a 0"),
  currency: z.enum(["ARS", "USD"]),
  period: z
    .enum(["weekly", "biweekly", "monthly", "quarterly", "annual"])
    .nullable(),
  start_date: z.string().min(1, "La fecha de inicio es obligatoria"),
  end_date: z.string().min(1, "La fecha de fin es obligatoria"),
  category_ids: z.array(z.string()),
  account_ids: z.array(z.string()),
  is_recurring: z.boolean(),
  rollover_enabled: z.boolean(),
  alert_threshold: z.coerce.number().int().min(1, "Debe ser entre 1 y 100").max(100, "Debe ser entre 1 y 100"),
})

/** Build a schema that includes account-currency coherence validation.
 *  Credit cards (tarjeta_credito) are wildcards — exempt from the restriction. */
function makeBudgetSchema(accounts: Account[]) {
  return budgetBaseSchema
    .refine(
      (data) => {
        if (!data.start_date || !data.end_date) return true
        return data.end_date >= data.start_date
      },
      {
        message: "La fecha de fin debe ser igual o posterior a la de inicio",
        path: ["end_date"],
      }
    )
    .refine(
      (data) => {
        // Defense in depth: every selected non-card account must share the budget currency.
        const selectedNonCards = accounts.filter(
          (a) => data.account_ids.includes(a.id) && a.type !== "tarjeta_credito"
        )
        return selectedNonCards.every((a) => a.currency === data.currency)
      },
      {
        message: "Todas las cuentas seleccionadas deben estar en la misma moneda que el presupuesto",
        path: ["account_ids"],
      }
    )
}

const PERIOD_OPTIONS: { value: BudgetPeriod; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "annual", label: "Anual" },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface BudgetFormProps {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  defaultValues?: Partial<BudgetFormValues>
  onSubmit: (values: BudgetFormValues) => Promise<void>
  onDelete?: () => void
  isLoading?: boolean
  submitLabel?: string
}

export function budgetToFormValues(budget: Budget): BudgetFormValues {
  // Derive end_date from the budget — if null, fallback to start_date
  const endDate = budget.end_date ?? budget.start_date
  return {
    name: budget.name,
    icon: budget.icon ?? "",
    limit_amount: budget.limit_amount,
    currency: budget.currency,
    period: budget.period,
    start_date: budget.start_date,
    end_date: endDate,
    category_ids: budget.category_ids,
    account_ids: budget.account_ids,
    is_recurring: budget.is_recurring,
    rollover_enabled: budget.rollover_enabled,
    alert_threshold: budget.alert_threshold,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Checks whether the given start/end dates match the calendarPeriodWindow of
 * a preset exactly. Returns the matched preset or null if custom.
 */
function detectPreset(
  startDate: string,
  endDate: string,
  ref: Date = new Date()
): BudgetPeriod | null {
  if (!startDate || !endDate) return null
  for (const { value } of PERIOD_OPTIONS) {
    const w = calendarPeriodWindow(value, ref)
    if (w.from === startDate && w.to === endDate) return value
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BudgetForm({
  categories,
  accounts,
  movements,
  defaultValues,
  onSubmit,
  onDelete,
  isLoading,
  submitLabel = "Guardar presupuesto",
}: BudgetFormProps) {
  const today = format(new Date(), "yyyy-MM-dd")
  const initialPreset = calendarPeriodWindow("monthly")

  const [pickerOpen, setPickerOpen] = useState(false)
  const isDemo = useIsDemo()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(makeBudgetSchema(accounts)) as unknown as Resolver<BudgetFormValues, any>,
    defaultValues: {
      name: "",
      icon: "",
      limit_amount: 0,
      currency: "ARS",
      period: "monthly",
      start_date: initialPreset.from,
      end_date: initialPreset.to,
      category_ids: [],
      account_ids: [],
      is_recurring: true,
      rollover_enabled: false,
      alert_threshold: 80,
      ...defaultValues,
    },
  })

  const watchedValues = watch()

  // ── Single-currency restriction ───────────────────────────────────────────
  // The currency of a budget is determined by the non-card accounts it covers.
  // Credit cards (tarjeta_credito) are wildcards: they work with any currency.
  const lockedCurrency = useMemo<"ARS" | "USD" | null>(() => {
    const selectedNonCards = accounts.filter(
      (a) => watchedValues.account_ids.includes(a.id) && a.type !== "tarjeta_credito"
    )
    if (selectedNonCards.length === 0) return null
    return selectedNonCards[0].currency as "ARS" | "USD"
  }, [accounts, watchedValues.account_ids])

  // When the locked currency changes, force the form currency to match.
  useEffect(() => {
    if (lockedCurrency !== null) {
      setValue("currency", lockedCurrency, { shouldValidate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedCurrency])

  // Filtered account options: when locked, hide accounts of the other currency
  // (but keep all credit cards regardless of their nominal currency).
  const accountOptions = useMemo(() => {
    const visible = lockedCurrency === null
      ? accounts
      : accounts.filter(
          (a) => a.type === "tarjeta_credito" || a.currency === lockedCurrency
        )
    return visible.map((a) => ({
      value: a.id,
      label: a.name,
      leading: <AccountIconChip icon={a.icon} />,
    }))
  }, [accounts, lockedCurrency])

  // Compute which preset (if any) matches current desde/hasta dates
  const activePreset = detectPreset(
    watchedValues.start_date,
    watchedValues.end_date
  )

  // When a preset button is clicked: set period + auto-fill dates
  function handlePresetClick(preset: BudgetPeriod) {
    const w = calendarPeriodWindow(preset)
    setValue("period", preset)
    setValue("start_date", w.from)
    setValue("end_date", w.to)
  }

  // When dates are edited manually: re-detect period (may become null = custom)
  function handleStartDateChange(d: Date) {
    const iso = format(d, "yyyy-MM-dd")
    setValue("start_date", iso)
    const detected = detectPreset(iso, watchedValues.end_date)
    setValue("period", detected)
  }

  function handleEndDateChange(d: Date) {
    const iso = format(d, "yyyy-MM-dd")
    setValue("end_date", iso)
    const detected = detectPreset(watchedValues.start_date, iso)
    setValue("period", detected)
  }

  // Expense categories only for scope selection
  const expenseCategories = categories.filter((c) => c.type === "expense")

  // Live preview
  const liveProgress = useMemo(() => {
    if (!watchedValues.limit_amount || watchedValues.limit_amount <= 0) return null

    const fakeBudget: Budget = {
      id: "__preview__",
      user_id: "",
      name: watchedValues.name,
      icon: watchedValues.icon || null,
      limit_amount: watchedValues.limit_amount,
      currency: watchedValues.currency,
      period: watchedValues.period,
      start_date: watchedValues.start_date || today,
      end_date: watchedValues.end_date || watchedValues.start_date || today,
      category_ids: watchedValues.category_ids,
      account_ids: watchedValues.account_ids,
      is_recurring: watchedValues.is_recurring,
      rollover_enabled: watchedValues.rollover_enabled,
      alert_threshold: watchedValues.alert_threshold,
      status: "active",
      created_at: "",
      updated_at: "",
    }

    return computeBudgetProgress(fakeBudget, movements)
  }, [
    watchedValues.limit_amount,
    watchedValues.currency,
    watchedValues.period,
    watchedValues.start_date,
    watchedValues.end_date,
    watchedValues.category_ids,
    watchedValues.account_ids,
    watchedValues.name,
    watchedValues.icon,
    watchedValues.is_recurring,
    watchedValues.rollover_enabled,
    watchedValues.alert_threshold,
    movements,
    today,
  ])

  const icon = watchedValues.icon

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* 1. Nombre */}
        <div className="space-y-1.5">
          <Label htmlFor="budget-name" className="text-xs text-muted-foreground font-medium">
            Nombre
          </Label>
          <Input
            id="budget-name"
            placeholder="Supermercado"
            {...register("name")}
            aria-invalid={!!errors.name}
            autoComplete="off"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* 2. Ícono */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Ícono</Label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={cn(
              "flex items-center gap-3 w-full h-11 px-3 rounded-xl border border-input bg-background",
              "text-sm transition-colors duration-150 cursor-pointer",
              "hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border/40 overflow-hidden flex-shrink-0">
              {icon ? (
                renderCategoryIcon(icon, { size: "h-5 w-5" })
              ) : (
                <Tag className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="text-muted-foreground flex-1 text-left">
              {icon ? "Cambiar ícono" : "Elegir ícono…"}
            </span>
            {icon && (
              <span
                role="button"
                aria-label="Quitar ícono"
                onClick={(e) => { e.stopPropagation(); setValue("icon", "") }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </div>

        {/* 3. Límite + Moneda */}
        <div className="space-y-1.5">
          <Label htmlFor="budget-limit" className="text-xs text-muted-foreground font-medium">
            Límite
          </Label>
          <MoneyInput
            id="budget-limit"
            min={0}
            step={0.01}
            className={cn(
              "text-2xl font-bold tabular-nums h-14 rounded-xl border-border/60",
              "focus:border-primary focus:ring-2 focus:ring-ring/30 w-full"
            )}
            placeholder="0"
            currency={watchedValues.currency}
            {...register("limit_amount")}
            aria-invalid={!!errors.limit_amount}
          />
          {errors.limit_amount && (
            <p className="text-xs text-destructive">{errors.limit_amount.message}</p>
          )}
          {lockedCurrency !== null ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Moneda:{" "}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lockedCurrency === "ARS" ? "/icons/ar/monedas/ARS.svg" : "/icons/ar/monedas/USD.svg"}
                alt=""
                className="h-4 w-4 object-contain shrink-0"
                aria-hidden="true"
              />
              <span className="font-semibold text-foreground">
                {lockedCurrency === "ARS" ? "Pesos (ARS)" : "Dólares (USD)"}
              </span>
            </p>
          ) : (
            <CurrencyToggle
              value={watchedValues.currency}
              onChange={(v) => setValue("currency", v)}
              className="w-full"
            />
          )}
        </div>

        {/* 4. Período — preset buttons + siempre-visible desde/hasta */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">Período</Label>

          {/* Preset pills */}
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePresetClick(value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 press-effect cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activePreset === value
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
            {!activePreset && watchedValues.start_date && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground border border-border/60">
                Personalizado
              </span>
            )}
          </div>

          {/* Desde / Hasta — always visible */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Desde</Label>
              <MangoDatePicker
                value={watchedValues.start_date ? parseISO(watchedValues.start_date) : null}
                onChange={handleStartDateChange}
                placeholder="Fecha inicio"
                aria-invalid={!!errors.start_date}
              />
              {errors.start_date && (
                <p className="text-xs text-destructive">{errors.start_date.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Hasta</Label>
              <MangoDatePicker
                value={watchedValues.end_date ? parseISO(watchedValues.end_date) : null}
                onChange={handleEndDateChange}
                placeholder="Fecha fin"
                aria-invalid={!!errors.end_date}
              />
              {(errors as { end_date?: { message?: string } }).end_date && (
                <p className="text-xs text-destructive">
                  {(errors as { end_date?: { message?: string } }).end_date?.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 5. Alcance — MangoMultiSelect para categorías y cuentas */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">Alcance</Label>
          <p className="text-[11px] text-muted-foreground -mt-0.5">
            Dejá vacío para incluir todas las categorías y cuentas.
          </p>

          {/* Categorías */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Categorías</Label>
            <MangoMultiSelect
              values={watchedValues.category_ids}
              onChange={(v) => setValue("category_ids", v)}
              options={expenseCategories.map((c) => ({
                value: c.id,
                label: c.name,
                leading: <CategoryIconChip icon={c.icon} />,
              }))}
              placeholder="Todas las categorías"
              showSearch
              aria-label="Categorías del presupuesto"
            />
          </div>

          {/* Cuentas */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Cuentas</Label>
            <MangoMultiSelect
              values={watchedValues.account_ids}
              onChange={(v) => setValue("account_ids", v)}
              options={accountOptions}
              placeholder="Todas las cuentas"
              showSearch
              aria-label="Cuentas del presupuesto"
            />
          </div>
        </div>

        {/* 6. Renova automáticamente */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="budget-recurring" className="cursor-pointer">
              Renova automáticamente
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Se reinicia solo al inicio de cada período.
            </p>
          </div>
          <Switch
            id="budget-recurring"
            checked={watchedValues.is_recurring}
            onCheckedChange={(v) => setValue("is_recurring", v)}
            aria-label="Renova automáticamente"
          />
        </div>

        {/* 6b. Acumular sobrante (solo si renueva automáticamente) */}
        {watchedValues.is_recurring && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="budget-rollover" className="cursor-pointer">
                Acumular sobrante al próximo período
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Si no gastás todo el límite, la diferencia se suma al período siguiente.
              </p>
            </div>
            <Switch
              id="budget-rollover"
              checked={watchedValues.rollover_enabled}
              onCheckedChange={(v) => setValue("rollover_enabled", v)}
              aria-label="Acumular sobrante al próximo período"
            />
          </div>
        )}

        {/* 6c. Umbral de alerta */}
        <div className="space-y-1.5">
          <Label htmlFor="budget-threshold" className="text-xs text-muted-foreground font-medium">
            Avisarme al alcanzar el %
          </Label>
          <Input
            id="budget-threshold"
            type="number"
            min={1}
            max={100}
            step={1}
            className="w-24"
            {...register("alert_threshold")}
            aria-invalid={!!errors.alert_threshold}
          />
          {errors.alert_threshold && (
            <p className="text-xs text-destructive">{errors.alert_threshold.message}</p>
          )}
        </div>

        {/* 7. Vista previa en vivo */}
        {liveProgress && (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>Gasto en esta ventana</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold tabular-nums">
                {formatCurrency(liveProgress.spent, watchedValues.currency)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                de {formatCurrency(liveProgress.limit, watchedValues.currency)} límite
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  liveProgress.status === "exceeded"
                    ? "bg-destructive"
                    : liveProgress.status === "near"
                    ? "bg-amber-500"
                    : "bg-success"
                )}
                style={{ width: `${Math.min(liveProgress.percent, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {liveProgress.percent.toFixed(0)}% del límite ·{" "}
              {periodLabel(watchedValues.period)} · ventana actual
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-2 pt-1">
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isLoading || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className="press-effect cursor-pointer"
            >
              Eliminar
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            className="flex-1 press-effect cursor-pointer font-semibold"
          >
            {isLoading ? "Guardando…" : submitLabel}
          </Button>
        </div>
      </form>

      {/* IconPicker — rendered outside the form so it doesn't submit */}
      <IconPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={icon ?? ""}
        onChange={(v) => setValue("icon", v)}
        logoCatalog="categories"
      />
    </>
  )
}
