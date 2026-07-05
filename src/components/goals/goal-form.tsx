"use client"

import { useState, useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { parseISO, format } from "date-fns"
import { Sparkles, TrendingDown, TrendingUp, ArrowUpRight, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { IconPicker } from "@/components/ui/icon-picker"
import { GoalProgressBar } from "@/components/goals/goal-progress-bar"
import { cn, formatCurrency } from "@/lib/utils"
import {
  computeGoalProgress,
  suggestBaseline,
  reductionTarget,
  periodEnd,
  isValidCustomRange,
  type Goal,
  type GoalScope,
  type GoalPeriod,
} from "@/lib/goals"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import { useIsDemo } from "@/lib/use-is-demo"

type Category = Tables<"categories">
type Account = Tables<"accounts">
type Movement = Tables<"movements">

// ── Schema ────────────────────────────────────────────────────────────────────

export const goalFormSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    icon: z.string().nullable(),
    type: z.enum(["income", "saving", "reduction"]),
    currency: z.enum(["ARS", "USD"]),
    // Period
    period: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annual", "custom"]),
    start_date: z.string().min(1, "La fecha de inicio es obligatoria"),
    end_date: z.string().min(1, "La fecha de fin es obligatoria"),
    recurring: z.boolean(),
    // Scope
    is_global: z.boolean(),
    account_ids: z.array(z.string()),
    category_ids: z.array(z.string()),
    // income / saving target
    target_amount: z.coerce.number().nullable(),
    // reduction specific
    target_percent: z.coerce.number().nullable(),
    baseline_amount: z.coerce.number().nullable(),
    // reduction categories (subset of category_ids when not global)
    reduction_category_ids: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    // Name already validated by min(1)

    // Type-specific target validation
    if (data.type === "income" || data.type === "saving") {
      if (!data.target_amount || data.target_amount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["target_amount"],
          message: "El objetivo debe ser mayor a 0",
        })
      }
    }
    if (data.type === "reduction") {
      if (!data.target_percent || data.target_percent <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["target_percent"],
          message: "Indicá un porcentaje de reducción mayor a 0",
        })
      }
      if (!data.baseline_amount || data.baseline_amount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["baseline_amount"],
          message: "El gasto base debe ser mayor a 0",
        })
      }
    }

    // Period: end must be after start for custom
    if (data.period === "custom") {
      if (data.start_date && data.end_date) {
        if (!isValidCustomRange(data.start_date, data.end_date)) {
          ctx.addIssue({
            code: "custom",
            path: ["end_date"],
            message: "La fecha de fin debe ser posterior al inicio",
          })
        }
      }
    }

    // Scope: when not global, at least one account or category must be selected
    if (!data.is_global) {
      if (data.account_ids.length === 0 && data.category_ids.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["account_ids"],
          message: "Seleccioná al menos una cuenta o categoría, o activá 'Meta global'",
        })
      }
    }
  })

export type GoalFormValues = z.infer<typeof goalFormSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GoalFormProps {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  /** Pass the resolved scope (from goal_accounts/goal_categories) for edit mode. */
  defaultScope?: GoalScope
  defaultValues?: Partial<GoalFormValues>
  onSubmit: (values: GoalFormValues) => Promise<void>
  onDelete?: () => void
  isLoading?: boolean
  submitLabel?: string
  /** userId — needed by IconPicker's upload tab */
  userId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0]

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
  custom: "Personalizado",
}

/**
 * Convert a DB goal + scope rows to GoalFormValues for the edit case.
 * goals-list should pass `defaultScope` separately (fetched from goal_accounts/goal_categories).
 */
export function goalToFormValues(
  goal: Goal,
  scope: GoalScope = { accountIds: [], categoryIds: [] }
): GoalFormValues {
  return {
    name: goal.name,
    icon: goal.icon ?? null,
    type: goal.type,
    currency: goal.currency,
    period: goal.period,
    start_date: goal.start_date,
    end_date: goal.end_date,
    recurring: goal.recurring,
    is_global: goal.is_global,
    account_ids: scope.accountIds,
    category_ids: scope.categoryIds,
    target_amount: goal.target_amount ?? null,
    target_percent: goal.target_percent ?? null,
    baseline_amount: goal.baseline_amount ?? null,
    reduction_category_ids: scope.categoryIds,
  }
}

// ── saveGoal — mutation helper for goals-list ─────────────────────────────────

/**
 * Upsert the goals row and sync goal_accounts / goal_categories.
 * Used by goals-list as the mutationFn for create and update.
 *
 * @param values  - form values
 * @param goalId  - when defined, performs an UPDATE; otherwise INSERT
 * @param userId  - required for INSERT
 */
export async function saveGoal(
  values: GoalFormValues,
  goalId: string | undefined,
  userId?: string
): Promise<Goal> {
  const supabase = createClient()

  // Determine target_amount for reduction (auto-calculate if not overridden)
  const resolvedTargetAmount =
    values.type === "reduction"
      ? values.baseline_amount && values.target_percent
        ? reductionTarget(values.baseline_amount, values.target_percent)
        : null
      : values.target_amount

  const goalPayload = {
    name: values.name,
    icon: values.icon,
    type: values.type,
    currency: values.currency,
    period: values.period,
    start_date: values.start_date,
    end_date: values.end_date,
    recurring: values.recurring,
    is_global: values.is_global,
    target_amount: resolvedTargetAmount,
    target_percent: values.type === "reduction" ? values.target_percent : null,
    baseline_amount: values.type === "reduction" ? values.baseline_amount : null,
    updated_at: new Date().toISOString(),
  }

  let goal: Goal

  if (goalId) {
    // UPDATE
    const { data, error } = await supabase
      .from("goals")
      .update(goalPayload)
      .eq("id", goalId)
      .select()
      .single()
    if (error) throw error
    goal = data
  } else {
    // INSERT
    if (!userId) throw new Error("No autenticado")
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...goalPayload, user_id: userId, status: "active" })
      .select()
      .single()
    if (error) throw error
    goal = data
  }

  // Sync goal_accounts
  const { error: delAccErr } = await supabase
    .from("goal_accounts")
    .delete()
    .eq("goal_id", goal.id)
  if (delAccErr) throw delAccErr

  if (!values.is_global && values.account_ids.length > 0) {
    const rows = values.account_ids.map((account_id) => ({
      goal_id: goal.id,
      account_id,
    }))
    const { error: insAccErr } = await supabase.from("goal_accounts").insert(rows)
    if (insAccErr) throw insAccErr
  }

  // Sync goal_categories
  const { error: delCatErr } = await supabase
    .from("goal_categories")
    .delete()
    .eq("goal_id", goal.id)
  if (delCatErr) throw delCatErr

  // For reduction: use reduction_category_ids; for others: category_ids
  const effectiveCategoryIds =
    values.type === "reduction"
      ? values.reduction_category_ids
      : values.category_ids

  if (!values.is_global && effectiveCategoryIds.length > 0) {
    const rows = effectiveCategoryIds.map((category_id) => ({
      goal_id: goal.id,
      category_id,
    }))
    const { error: insCatErr } = await supabase.from("goal_categories").insert(rows)
    if (insCatErr) throw insCatErr
  }

  return goal
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GoalForm({
  categories,
  accounts,
  movements,
  defaultScope,
  defaultValues,
  onSubmit,
  onDelete,
  isLoading,
  submitLabel = "Crear meta",
  userId,
}: GoalFormProps) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const isDemo = useIsDemo()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GoalFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(goalFormSchema) as unknown as Resolver<GoalFormValues, any>,
    defaultValues: {
      name: "",
      icon: null,
      type: "saving",
      currency: "ARS",
      period: "monthly",
      start_date: today(),
      end_date: periodEnd(today(), "monthly"),
      recurring: false,
      is_global: true,
      account_ids: defaultScope?.accountIds ?? [],
      category_ids: defaultScope?.categoryIds ?? [],
      target_amount: null,
      target_percent: null,
      baseline_amount: null,
      reduction_category_ids: defaultScope?.categoryIds ?? [],
      ...defaultValues,
    },
  })

  const v = watch()
  const goalType = v.type
  const isGlobal = v.is_global

  // ── Period auto-complete ────────────────────────────────────────────────────

  function handlePeriodChange(period: GoalPeriod) {
    setValue("period", period)
    if (period !== "custom" && v.start_date) {
      setValue("end_date", periodEnd(v.start_date, period))
    }
  }

  function handleStartDateChange(date: Date) {
    const iso = format(date, "yyyy-MM-dd")
    setValue("start_date", iso)
    if (v.period !== "custom") {
      setValue("end_date", periodEnd(iso, v.period as Exclude<GoalPeriod, "custom">))
    }
  }

  // ── Baseline suggestion ─────────────────────────────────────────────────────

  function handleSuggestBaseline() {
    setSuggesting(true)
    const scope = {
      categoryIds: v.reduction_category_ids,
      accountIds: isGlobal ? [] : v.account_ids,
      isGlobal,
    }
    const suggested = suggestBaseline(scope, movements, v.currency)
    setValue("baseline_amount", suggested > 0 ? suggested : null)
    setSuggesting(false)
  }

  // ── Live preview ────────────────────────────────────────────────────────────

  const liveProgress = useMemo(() => {
    if (goalType === "income" || goalType === "saving") {
      if (!v.target_amount || v.target_amount <= 0) return null
    }
    if (goalType === "reduction") {
      if (!v.baseline_amount || v.baseline_amount <= 0) return null
      if (!v.target_percent || v.target_percent <= 0) return null
    }

    const targetAmt =
      goalType === "reduction"
        ? reductionTarget(v.baseline_amount ?? 0, v.target_percent ?? 0)
        : v.target_amount ?? 0

    const fakeGoal: Goal = {
      id: "__preview__",
      user_id: "",
      name: v.name,
      icon: v.icon,
      type: goalType,
      currency: v.currency,
      period: v.period,
      start_date: v.start_date,
      end_date: v.end_date,
      recurring: v.recurring,
      is_global: isGlobal,
      target_amount: targetAmt,
      target_percent: goalType === "reduction" ? v.target_percent : null,
      baseline_amount: goalType === "reduction" ? v.baseline_amount : null,
      status: "active",
      deadline: null,
      created_at: "",
      updated_at: "",
    }

    const scope: GoalScope = {
      accountIds: isGlobal ? [] : v.account_ids,
      categoryIds: isGlobal
        ? []
        : goalType === "reduction"
        ? v.reduction_category_ids
        : v.category_ids,
    }

    return computeGoalProgress(fakeGoal, movements, scope)
  }, [
    goalType,
    v.target_amount,
    v.target_percent,
    v.baseline_amount,
    v.currency,
    v.period,
    v.start_date,
    v.end_date,
    v.account_ids,
    v.category_ids,
    v.reduction_category_ids,
    v.name,
    v.icon,
    v.recurring,
    isGlobal,
    movements,
  ])

  // ── Option builders ─────────────────────────────────────────────────────────

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    leading: <AccountIconChip icon={a.icon} />,
  }))

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
    leading: c.icon ? <CategoryIconChip icon={c.icon} /> : undefined,
  }))

  const expenseCategoryOptions = categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      value: c.id,
      label: c.name,
      leading: c.icon ? <CategoryIconChip icon={c.icon} /> : undefined,
    }))

  // Auto-calculated target for reduction (shown inline)
  const reductionTargetAmount =
    goalType === "reduction" && v.baseline_amount && v.target_percent
      ? reductionTarget(v.baseline_amount, v.target_percent)
      : null

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Type pill group ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Tipo de meta</Label>
          <div className="flex gap-1 p-1 rounded-xl bg-muted">
            {(["income", "saving", "reduction"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue("type", t)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  goalType === t
                    ? t === "income"
                      ? "bg-success text-white shadow-sm"
                      : t === "saving"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-amber-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "income" ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : t === "saving" ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {t === "income" ? "Ingreso" : t === "saving" ? "Ahorro" : "Reducción"}
                </span>
                <span className="sm:hidden">
                  {t === "income" ? "Ing." : t === "saving" ? "Ahorro" : "Red."}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Name ────────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="goal-name" className="text-xs text-muted-foreground font-medium">
            Nombre de la meta
          </Label>
          <Input
            id="goal-name"
            placeholder={
              goalType === "income"
                ? "Meta de ingresos"
                : goalType === "saving"
                ? "Fondo de emergencia"
                : "Reducir salidas"
            }
            {...register("name")}
            aria-invalid={!!errors.name}
            autoComplete="off"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* ── Icon + Currency row ──────────────────────────────────────────── */}
        <div className="flex items-end gap-3">
          {/* Icon picker trigger */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Ícono</Label>
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              className={cn(
                "h-10 w-14 rounded-lg border border-input bg-background flex items-center justify-center",
                "text-xl hover:border-primary/40 transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label="Elegir ícono"
            >
              {v.icon ? (
                v.icon.startsWith("http") || v.icon.startsWith("/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.icon} alt="ícono" className="h-7 w-7 rounded-lg object-cover" />
                ) : (
                  <span aria-hidden>{v.icon}</span>
                )
              ) : (
                <span className="text-muted-foreground text-sm">+</span>
              )}
            </button>
          </div>

          {/* Currency toggle */}
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs text-muted-foreground font-medium">Moneda</Label>
            <CurrencyToggle
              value={v.currency}
              onChange={(val) => setValue("currency", val)}
              className="w-full"
            />
          </div>
        </div>

        {/* ── Period block ─────────────────────────────────────────────────── */}
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
          <Label className="text-xs text-muted-foreground font-medium">Período</Label>

          {/* Preset selector */}
          <MangoSelect
            value={v.period}
            onChange={(val) => handlePeriodChange(val as GoalPeriod)}
            options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            aria-label="Período de la meta"
          />

          {/* Start / End dates — always visible */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Inicio</Label>
              <MangoDatePicker
                value={v.start_date ? parseISO(v.start_date) : null}
                onChange={handleStartDateChange}
                placeholder="Fecha de inicio"
                aria-invalid={!!errors.start_date}
              />
              {errors.start_date && (
                <p className="text-xs text-destructive">{errors.start_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Fin</Label>
              <MangoDatePicker
                value={v.end_date ? parseISO(v.end_date) : null}
                onChange={(date) => {
                  if (v.period === "custom") {
                    setValue("end_date", format(date, "yyyy-MM-dd"))
                  }
                  // Non-custom: end date is read-only (auto-calculated)
                }}
                placeholder="Fecha de fin"
                aria-invalid={!!errors.end_date}
              />
              {errors.end_date && (
                <p className="text-xs text-destructive">{errors.end_date.message}</p>
              )}
              {v.period !== "custom" && (
                <p className="text-[10px] text-muted-foreground">
                  Calculada automáticamente
                </p>
              )}
            </div>
          </div>

          {/* Recurring toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={v.recurring}
              onChange={(e) => setValue("recurring", e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium">Meta recurrente</span>
            <span className="text-xs text-muted-foreground">
              (se renueva al vencer el período)
            </span>
          </label>
        </div>

        {/* ── Income / Saving target amount ───────────────────────────────── */}
        {(goalType === "income" || goalType === "saving") && (
          <div className="space-y-1.5">
            <Label htmlFor="goal-target" className="text-xs text-muted-foreground font-medium">
              {goalType === "income" ? "Objetivo de ingresos" : "Objetivo de ahorro"}
            </Label>
            <MoneyInput
              id="goal-target"
              min={0}
              step={0.01}
              className="tabular-nums w-full"
              placeholder="0"
              currency={v.currency}
              {...register("target_amount")}
              aria-invalid={!!errors.target_amount}
            />
            {errors.target_amount && (
              <p className="text-xs text-destructive">{errors.target_amount.message}</p>
            )}
          </div>
        )}

        {/* ── Reduction specific fields ───────────────────────────────────── */}
        {goalType === "reduction" && (
          <>
            {/* Categories for reduction */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Categorías a reducir
              </Label>
              <MangoMultiSelect
                values={v.reduction_category_ids}
                onChange={(vals) => setValue("reduction_category_ids", vals)}
                options={expenseCategoryOptions}
                placeholder="Todas las categorías de gasto"
                showSearch
                aria-label="Categorías para reducción"
              />
              <p className="text-[11px] text-muted-foreground">
                Sin selección = todas las categorías de gasto
              </p>
            </div>

            {/* Reduction % */}
            <div className="space-y-1.5">
              <Label htmlFor="red-target-pct" className="text-xs text-muted-foreground font-medium">
                Reducción objetivo (%)
              </Label>
              <div className="relative">
                <Input
                  id="red-target-pct"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  className="pr-8 tabular-nums"
                  placeholder="20"
                  {...register("target_percent")}
                  aria-invalid={!!errors.target_percent}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">
                  %
                </span>
              </div>
              {errors.target_percent && (
                <p className="text-xs text-destructive">{errors.target_percent.message}</p>
              )}
            </div>

            {/* Baseline */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="red-baseline" className="text-xs text-muted-foreground font-medium">
                  Gasto base mensual
                </Label>
                <button
                  type="button"
                  onClick={handleSuggestBaseline}
                  disabled={suggesting}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
                >
                  <Calculator className="h-3 w-3" />
                  Calcular de mi historial
                </button>
              </div>
              <MoneyInput
                id="red-baseline"
                min={0}
                step={0.01}
                className="tabular-nums w-full"
                placeholder="0"
                currency={v.currency}
                {...register("baseline_amount")}
                aria-invalid={!!errors.baseline_amount}
              />
              {errors.baseline_amount && (
                <p className="text-xs text-destructive">{errors.baseline_amount.message}</p>
              )}
            </div>

            {/* Auto-calculated target amount */}
            {reductionTargetAmount !== null && (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Monto objetivo calculado</span>
                <span className="text-sm font-bold tabular-nums">
                  {formatCurrency(reductionTargetAmount, v.currency)}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Global flag + scope selectors ───────────────────────────────── */}
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
          {/* Global check */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={v.is_global}
              onChange={(e) => setValue("is_global", e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium">Meta global</span>
            <span className="text-xs text-muted-foreground">
              (aplica a todas las cuentas y categorías)
            </span>
          </label>

          {/* Scope selectors — only when not global */}
          {!isGlobal && goalType !== "reduction" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Cuentas</Label>
                <MangoMultiSelect
                  values={v.account_ids}
                  onChange={(vals) => setValue("account_ids", vals)}
                  options={accountOptions}
                  placeholder="Todas las cuentas"
                  showSearch
                  aria-label="Cuentas del alcance"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Categorías</Label>
                <MangoMultiSelect
                  values={v.category_ids}
                  onChange={(vals) => setValue("category_ids", vals)}
                  options={categoryOptions}
                  placeholder="Todas las categorías"
                  showSearch
                  aria-label="Categorías del alcance"
                />
              </div>
              {errors.account_ids && (
                <p className="text-xs text-destructive">{errors.account_ids.message}</p>
              )}
            </>
          )}

          {/* For reduction, scope = accounts only (categories are in reduction_category_ids) */}
          {!isGlobal && goalType === "reduction" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Cuentas</Label>
              <MangoMultiSelect
                values={v.account_ids}
                onChange={(vals) => setValue("account_ids", vals)}
                options={accountOptions}
                placeholder="Todas las cuentas"
                showSearch
                aria-label="Cuentas del alcance"
              />
            </div>
          )}
        </div>

        {/* ── Live progress preview ────────────────────────────────────────── */}
        {liveProgress && (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Progreso actual en el período</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-bold tabular-nums">
                {formatCurrency(liveProgress.value, v.currency)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                de {formatCurrency(liveProgress.target, v.currency)} objetivo
              </span>
            </div>
            <GoalProgressBar
              percent={liveProgress.percent}
              status={liveProgress.status}
              label={
                goalType === "reduction"
                  ? "del presupuesto usado"
                  : "alcanzado"
              }
            />
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
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

      {/* Icon picker sheet (outside form to avoid nested form issues) */}
      <IconPicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        value={v.icon ?? ""}
        onChange={(val) => setValue("icon", val)}
        userId={userId}
        logoCatalog="categories"
      />
    </>
  )
}
