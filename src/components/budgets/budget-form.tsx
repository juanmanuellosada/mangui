"use client"

import { useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { X, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatCurrency } from "@/lib/utils"
import {
  periodLabel,
  computeBudgetProgress,
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
  limit_amount: number
  currency: "ARS" | "USD"
  period: BudgetPeriod
  category_ids: string[]
  account_ids: string[]
  is_recurring: boolean
  start_date: string
}

const budgetSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  limit_amount: z.coerce.number().positive("El límite debe ser mayor a 0"),
  currency: z.enum(["ARS", "USD"]),
  period: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annual"]),
  category_ids: z.array(z.string()),
  account_ids: z.array(z.string()),
  is_recurring: z.boolean(),
  start_date: z.string().min(1),
})

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
  return {
    name: budget.name,
    limit_amount: budget.limit_amount,
    currency: budget.currency,
    period: budget.period,
    category_ids: budget.category_ids,
    account_ids: budget.account_ids,
    is_recurring: budget.is_recurring,
    start_date: budget.start_date,
  }
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(budgetSchema) as unknown as Resolver<BudgetFormValues, any>,
    defaultValues: {
      name: "",
      limit_amount: 0,
      currency: "ARS",
      period: "monthly",
      category_ids: [],
      account_ids: [],
      is_recurring: true,
      start_date: today,
      ...defaultValues,
    },
  })

  const watchedValues = watch()

  // Live preview: compute progress from watched form values
  const liveProgress = useMemo(() => {
    if (!watchedValues.limit_amount || watchedValues.limit_amount <= 0) return null

    const fakeBudget: Budget = {
      id: "__preview__",
      user_id: "",
      name: watchedValues.name,
      limit_amount: watchedValues.limit_amount,
      currency: watchedValues.currency,
      period: watchedValues.period,
      start_date: watchedValues.start_date || today,
      category_ids: watchedValues.category_ids,
      account_ids: watchedValues.account_ids,
      is_recurring: watchedValues.is_recurring,
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
    watchedValues.category_ids,
    watchedValues.account_ids,
    watchedValues.name,
    watchedValues.is_recurring,
    movements,
    today,
  ])

  // Toggle helpers for multi-select chips
  const toggleCategory = (id: string) => {
    const current = watchedValues.category_ids
    if (current.includes(id)) {
      setValue("category_ids", current.filter((x) => x !== id))
    } else {
      setValue("category_ids", [...current, id])
    }
  }

  const toggleAccount = (id: string) => {
    const current = watchedValues.account_ids
    if (current.includes(id)) {
      setValue("account_ids", current.filter((x) => x !== id))
    } else {
      setValue("account_ids", [...current, id])
    }
  }

  const clearAll = () => {
    setValue("category_ids", [])
    setValue("account_ids", [])
  }

  const hasScope =
    watchedValues.category_ids.length > 0 || watchedValues.account_ids.length > 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="budget-name">Nombre</Label>
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

      {/* Limit + Currency */}
      <div className="space-y-1.5">
        <Label htmlFor="budget-limit">Límite</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">
              $
            </span>
            <Input
              id="budget-limit"
              type="number"
              min={0}
              step={0.01}
              className="pl-7 tabular-nums"
              placeholder="50.000"
              {...register("limit_amount")}
              aria-invalid={!!errors.limit_amount}
            />
          </div>
          <Select
            value={watchedValues.currency}
            onValueChange={(v) => setValue("currency", v as "ARS" | "USD")}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {errors.limit_amount && (
          <p className="text-xs text-destructive">{errors.limit_amount.message}</p>
        )}
      </div>

      {/* Period */}
      <div className="space-y-1.5">
        <Label>Período</Label>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue("period", value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 press-effect cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                watchedValues.period === value
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope: categories + accounts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Alcance</Label>
          {hasScope && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Global
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground -mt-0.5">
          Dejá vacío para incluir todas las categorías y cuentas.
        </p>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isActive = watchedValues.category_ids.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer press-effect",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Account chips */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {accounts.map((acc) => {
              const isActive = watchedValues.account_ids.includes(acc.id)
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => toggleAccount(acc.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer press-effect",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  {acc.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Recurring toggle */}
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

      {/* Live preview */}
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

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="press-effect cursor-pointer"
          >
            Eliminar
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 press-effect cursor-pointer font-semibold"
        >
          {isLoading ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
