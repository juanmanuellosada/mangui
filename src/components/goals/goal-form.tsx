"use client"

import { useState, useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { Sparkles, TrendingDown, TrendingUp, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { cn, formatCurrency } from "@/lib/utils"
import {
  computeSavingProgress,
  computeReductionProgress,
  suggestBaseline,
  type Goal,
} from "@/lib/goals"
import type { Tables } from "@/lib/database.types"

type Category = Tables<"categories">
type Account = Tables<"accounts">
type Movement = Tables<"movements">

// ── Schema ────────────────────────────────────────────────────────────────────

export type GoalFormValues = {
  name: string
  type: "saving" | "reduction"
  // saving
  target_amount: number | null
  currency: "ARS" | "USD"
  category_id: string | null
  account_id: string | null
  deadline: string | null
  // reduction
  baseline_amount: number | null
  target_percent: number | null
}

const goalSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    type: z.enum(["saving", "reduction"]),
    target_amount: z.coerce.number().nullable(),
    currency: z.enum(["ARS", "USD"]),
    category_id: z.string().nullable(),
    account_id: z.string().nullable(),
    deadline: z.string().nullable(),
    baseline_amount: z.coerce.number().nullable(),
    target_percent: z.coerce.number().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "saving") {
      if (!data.target_amount || data.target_amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["target_amount"], message: "El objetivo debe ser mayor a 0" })
      }
    }
    if (data.type === "reduction") {
      if (!data.baseline_amount || data.baseline_amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["baseline_amount"], message: "El gasto base debe ser mayor a 0" })
      }
      if (!data.target_percent && !data.target_amount) {
        ctx.addIssue({ code: "custom", path: ["target_percent"], message: "Indicá un objetivo de reducción (% o monto)" })
      }
    }
  })

interface GoalFormProps {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  defaultValues?: Partial<GoalFormValues>
  onSubmit: (values: GoalFormValues) => Promise<void>
  onDelete?: () => void
  isLoading?: boolean
  submitLabel?: string
}

export function goalToFormValues(goal: Goal): GoalFormValues {
  return {
    name: goal.name,
    type: goal.type,
    target_amount: goal.target_amount,
    currency: goal.currency,
    category_id: goal.category_id,
    account_id: goal.account_id,
    deadline: goal.deadline,
    baseline_amount: goal.baseline_amount,
    target_percent: goal.target_percent,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GoalForm({
  categories,
  accounts,
  movements,
  defaultValues,
  onSubmit,
  onDelete,
  isLoading,
  submitLabel = "Crear meta",
}: GoalFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GoalFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(goalSchema) as unknown as Resolver<GoalFormValues, any>,
    defaultValues: {
      name: "",
      type: "saving",
      target_amount: null,
      currency: "ARS",
      category_id: null,
      account_id: null,
      deadline: null,
      baseline_amount: null,
      target_percent: null,
      ...defaultValues,
    },
  })

  const watchedValues = watch()
  const goalType = watchedValues.type

  // Live progress preview for saving
  const savingPreview = useMemo(() => {
    if (goalType !== "saving") return null
    if (!watchedValues.target_amount || watchedValues.target_amount <= 0) return null

    const fakeGoal: Goal = {
      id: "__preview__",
      user_id: "",
      name: watchedValues.name,
      type: "saving",
      target_amount: watchedValues.target_amount,
      target_percent: null,
      baseline_amount: null,
      currency: watchedValues.currency,
      category_id: watchedValues.category_id,
      account_id: watchedValues.account_id,
      deadline: watchedValues.deadline,
      status: "active",
      created_at: new Date(0).toISOString(), // from beginning of time for preview
      updated_at: "",
    }
    return computeSavingProgress(fakeGoal, movements)
  }, [
    goalType,
    watchedValues.target_amount,
    watchedValues.currency,
    watchedValues.category_id,
    watchedValues.account_id,
    watchedValues.name,
    watchedValues.deadline,
    movements,
  ])

  // Live progress preview for reduction
  const reductionPreview = useMemo(() => {
    if (goalType !== "reduction") return null
    if (!watchedValues.baseline_amount || watchedValues.baseline_amount <= 0) return null

    const fakeGoal: Goal = {
      id: "__preview__",
      user_id: "",
      name: watchedValues.name,
      type: "reduction",
      target_amount: watchedValues.target_amount,
      target_percent: watchedValues.target_percent,
      baseline_amount: watchedValues.baseline_amount,
      currency: watchedValues.currency,
      category_id: watchedValues.category_id,
      account_id: watchedValues.account_id,
      deadline: watchedValues.deadline,
      status: "active",
      created_at: "",
      updated_at: "",
    }
    return computeReductionProgress(fakeGoal, movements)
  }, [
    goalType,
    watchedValues.baseline_amount,
    watchedValues.target_percent,
    watchedValues.target_amount,
    watchedValues.category_id,
    watchedValues.account_id,
    watchedValues.name,
    watchedValues.currency,
    watchedValues.deadline,
    movements,
  ])

  // Baseline suggestion
  const [suggesting, setSuggesting] = useState(false)
  const handleSuggestBaseline = () => {
    setSuggesting(true)
    const fakeGoal = {
      category_id: watchedValues.category_id,
      account_id: watchedValues.account_id,
    }
    const suggested = suggestBaseline(fakeGoal, movements)
    setValue("baseline_amount", suggested > 0 ? suggested : null)
    setSuggesting(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Type toggle */}
      <div className="space-y-1.5">
        <Label>Tipo de meta</Label>
        <div className="flex gap-2 p-1 rounded-xl bg-muted">
          {(["saving", "reduction"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValue("type", t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                goalType === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "saving" ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {t === "saving" ? "Ahorro" : "Reducción"}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">Nombre de la meta</Label>
        <Input
          id="goal-name"
          placeholder={goalType === "saving" ? "Fondo de emergencia" : "Reducir salidas"}
          {...register("name")}
          aria-invalid={!!errors.name}
          autoComplete="off"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* ── SAVING fields ── */}
      {goalType === "saving" && (
        <>
          {/* Target amount + currency */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Objetivo de ahorro</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <MoneyInput
                  id="goal-target"
                  min={0}
                  step={0.01}
                  className="tabular-nums w-full"
                  placeholder="500"
                  currency={watchedValues.currency}
                  {...register("target_amount")}
                  aria-invalid={!!errors.target_amount}
                />
              </div>
              <MangoSelect
                value={watchedValues.currency}
                onChange={(v) => setValue("currency", v as "ARS" | "USD")}
                options={[
                  { value: "ARS", label: "ARS", leading: <span className="text-sm" aria-hidden>🇦🇷</span> },
                  { value: "USD", label: "US$", leading: <span className="text-sm" aria-hidden>🇺🇸</span> },
                ]}
                className="w-28"
                aria-label="Moneda"
              />
            </div>
            {errors.target_amount && (
              <p className="text-xs text-destructive">{errors.target_amount.message}</p>
            )}
          </div>

          {/* Category (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-category">Categoría (opcional)</Label>
            <MangoSelect
              id="goal-category"
              value={watchedValues.category_id ?? "__none__"}
              onChange={(v) => setValue("category_id", v === "__none__" ? null : v)}
              options={[
                { value: "__none__", label: "Sin filtro" },
                ...categories.filter(c => c.type === "income" || c.type === "expense").map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="Sin filtro"
            />
          </div>

          {/* Account (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-account">Cuenta (opcional)</Label>
            <MangoSelect
              id="goal-account"
              value={watchedValues.account_id ?? "__none__"}
              onChange={(v) => setValue("account_id", v === "__none__" ? null : v)}
              options={[
                { value: "__none__", label: "Todas las cuentas" },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
              placeholder="Todas las cuentas"
            />
          </div>

          {/* Deadline (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-deadline">Fecha límite (opcional)</Label>
            <Input
              id="goal-deadline"
              type="date"
              {...register("deadline")}
              onChange={(e) => setValue("deadline", e.target.value || null)}
            />
          </div>
        </>
      )}

      {/* ── REDUCTION fields ── */}
      {goalType === "reduction" && (
        <>
          {/* Category (key for reduction) */}
          <div className="space-y-1.5">
            <Label htmlFor="red-category">Categoría</Label>
            <MangoSelect
              id="red-category"
              value={watchedValues.category_id ?? "__none__"}
              onChange={(v) => setValue("category_id", v === "__none__" ? null : v)}
              options={[
                { value: "__none__", label: "Todas (sin filtro)" },
                ...categories.filter(c => c.type === "expense").map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="Seleccioná una categoría"
            />
          </div>

          {/* Baseline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="red-baseline">Gasto base mensual</Label>
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
              placeholder="16.000"
              currency={watchedValues.currency}
              {...register("baseline_amount")}
              aria-invalid={!!errors.baseline_amount}
            />
            {errors.baseline_amount && (
              <p className="text-xs text-destructive">{errors.baseline_amount.message}</p>
            )}
          </div>

          {/* Target: percent or amount */}
          <div className="space-y-1.5">
            <Label htmlFor="red-target-pct">Reducción objetivo (%)</Label>
            <div className="relative">
              <Input
                id="red-target-pct"
                type="number"
                min={0}
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
            <p className="text-[11px] text-muted-foreground">
              O bien, indicá un monto objetivo mensual máximo.
            </p>
          </div>

          {/* Target amount alternative */}
          <div className="space-y-1.5">
            <Label htmlFor="red-target-amt">Monto objetivo (opcional)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <MoneyInput
                  id="red-target-amt"
                  min={0}
                  step={0.01}
                  className="tabular-nums w-full"
                  placeholder="Máximo mensual"
                  currency={watchedValues.currency}
                  {...register("target_amount")}
                />
              </div>
              <MangoSelect
                value={watchedValues.currency}
                onChange={(v) => setValue("currency", v as "ARS" | "USD")}
                options={[
                  { value: "ARS", label: "ARS", leading: <span className="text-sm" aria-hidden>🇦🇷</span> },
                  { value: "USD", label: "US$", leading: <span className="text-sm" aria-hidden>🇺🇸</span> },
                ]}
                className="w-28"
                aria-label="Moneda"
              />
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="red-deadline">Fecha límite (opcional)</Label>
            <Input
              id="red-deadline"
              type="date"
              {...register("deadline")}
              onChange={(e) => setValue("deadline", e.target.value || null)}
            />
          </div>
        </>
      )}

      {/* ── Live preview ── */}
      {(savingPreview || reductionPreview) && (
        <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Progreso actual</span>
          </div>

          {savingPreview && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-bold tabular-nums">
                  {formatCurrency(savingPreview.accumulated, watchedValues.currency)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  de {formatCurrency(savingPreview.target, watchedValues.currency)} objetivo
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden" role="progressbar"
                aria-valuenow={Math.round(savingPreview.percent)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full rounded-full bg-success transition-all duration-300"
                  style={{ width: `${savingPreview.percent}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {savingPreview.percent.toFixed(0)}% alcanzado
                {savingPreview.reached && " · ¡Objetivo cumplido!"}
              </p>
            </>
          )}

          {reductionPreview && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-bold tabular-nums">
                  {formatCurrency(reductionPreview.currentMonthSpend, watchedValues.currency)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  vs base {formatCurrency(reductionPreview.baseline, watchedValues.currency)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    reductionPreview.met ? "bg-success" : "bg-amber-500"
                  )}
                  style={{
                    width: `${Math.min((reductionPreview.currentMonthSpend / (reductionPreview.baseline || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {reductionPreview.reductionPct >= 0
                  ? `−${reductionPreview.reductionPct.toFixed(0)}% vs base`
                  : `+${Math.abs(reductionPreview.reductionPct).toFixed(0)}% vs base`}
                {reductionPreview.targetPct > 0 && ` · objetivo: −${reductionPreview.targetPct.toFixed(0)}%`}
                {reductionPreview.met && " · ¡Objetivo cumplido!"}
              </p>
            </>
          )}
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
