"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { Zap, X } from "lucide-react"
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
import {
  RULES_KEY,
  RULE_CONDITIONS_KEY,
  findMatchingRule,
  type AutoRule,
  type AutoRuleCondition,
} from "@/lib/rules"
import { createClient } from "@/lib/supabase/client"

type Category = Tables<"categories">

// ── Rule fetchers (used only in create mode) ─────────────────────────────────

async function fetchActiveRules(): Promise<AutoRule[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("auto_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false })
  return data ?? []
}

async function fetchRuleConditions(): Promise<AutoRuleCondition[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("auto_rule_conditions")
    .select("*")
    .order("position")
  return data ?? []
}

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
  /** When true, enables rule auto-fill on category/account. Default false (edit mode is safe). */
  isCreateMode?: boolean
}

export function MovementForm({
  accounts,
  categories,
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar",
  isCreateMode = false,
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
  const note = watch("note")
  const categoryId = watch("category_id")

  // ── Rule auto-fill (create mode only) ─────────────────────────────────────
  const [ruleHint, setRuleHint] = useState<{ ruleName: string; ruleId: string } | null>(null)
  // Track if user manually set the category (to avoid overriding)
  const userSetCategory = useRef(false)

  const { data: activeRules = [] } = useQuery({
    queryKey: RULES_KEY,
    queryFn: fetchActiveRules,
    enabled: isCreateMode,
    staleTime: 60_000,
  })

  const { data: ruleConditions = [] } = useQuery({
    queryKey: RULE_CONDITIONS_KEY,
    queryFn: fetchRuleConditions,
    enabled: isCreateMode,
    staleTime: 60_000,
  })

  const condsByRule = useMemo(() => {
    const map = new Map<string, AutoRuleCondition[]>()
    for (const c of ruleConditions) {
      if (!map.has(c.rule_id)) map.set(c.rule_id, [])
      map.get(c.rule_id)!.push(c)
    }
    return map
  }, [ruleConditions])

  // Evaluate rules when relevant fields change
  useEffect(() => {
    if (!isCreateMode || activeRules.length === 0) return
    // Don't override if user has manually picked a category
    if (userSetCategory.current) return

    const draft = {
      note: note ?? undefined,
      amount: amount ?? undefined,
      account_id: accountId ?? undefined,
      type,
    }
    const matched = findMatchingRule(activeRules, condsByRule, draft)
    if (matched) {
      if (matched.action_category_id) {
        setValue("category_id", matched.action_category_id)
      }
      if (matched.action_account_id) {
        setValue("account_id", matched.action_account_id)
      }
      setRuleHint({ ruleName: matched.name, ruleId: matched.id })
    } else {
      // Clear hint if no rule matches and we were using a rule hint
      setRuleHint((prev) => (prev ? null : prev))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, amount, accountId, type, isCreateMode, activeRules.length, condsByRule])

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

  const submitLabel_resolved = submitLabel !== "Guardar"
    ? submitLabel
    : type === "income" ? "Guardar ingreso" : "Guardar gasto"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Type toggle — Gasto / Ingreso (3-way if transferencia available, but form only handles movements) */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setValue("type", t, { shouldValidate: true })
              setValue("category_id", null)
            }}
            className={cn(
              "flex-1 h-9 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer press-effect",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              type === t
                ? t === "income"
                  ? "bg-success text-white shadow-sm"
                  : "bg-destructive text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "income" ? "Ingreso" : "Gasto"}
          </button>
        ))}
      </div>

      {/* Amount — prominent, large */}
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
              "focus:border-primary focus:ring-2 focus:ring-ring/30",
              type === "income" ? "focus:border-success" : "focus:border-destructive"
            )}
            {...register("amount")}
            aria-invalid={!!errors.amount}
          />
          {/* Currency select inline */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Select
              value={originalCurrency}
              onValueChange={(v) => {
                setValue("original_currency", v as "ARS" | "USD", { shouldValidate: true })
                setValue("converted_amount", null)
              }}
            >
              <SelectTrigger className="w-20 h-8 text-xs font-bold border-border/60 bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Escribí el monto en {originalCurrency === "ARS" ? "pesos" : "dólares"}
        </p>
      </div>

      {/* Cuenta + Categoría — 2-col row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Cuenta</Label>
          <Select
            value={accountId}
            onValueChange={(v) => v && setValue("account_id", v, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.account_id && (
            <p className="text-xs text-destructive">{errors.account_id.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between min-h-4">
            <Label className="text-xs text-muted-foreground font-medium">Categoría</Label>
            {ruleHint && !userSetCategory.current && (
              <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                Auto
              </span>
            )}
          </div>
          <Select
            value={categoryId ?? "none"}
            onValueChange={(v) => {
              userSetCategory.current = true
              setRuleHint(null)
              setValue("category_id", v === "none" ? null : v)
            }}
          >
            <SelectTrigger className={cn("w-full", ruleHint && !userSetCategory.current && "border-primary/50 ring-1 ring-primary/20")}>
              <SelectValue placeholder="Categoría" />
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
      </div>

      {/* Rule hint chip */}
      {ruleHint && !userSetCategory.current && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
          <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-primary flex-1">
            Sugerido por regla: <strong>{ruleHint.ruleName}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              userSetCategory.current = true
              setRuleHint(null)
              setValue("category_id", null)
            }}
            className="text-primary/70 hover:text-primary transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="Descartar sugerencia"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
          </div>

          {/* Converted amount field */}
          <div className="space-y-1.5">
            <Label htmlFor="converted_amount" className="text-xs text-muted-foreground font-medium">
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

      {/* Descripción (nota) */}
      <div className="space-y-1.5">
        <Label htmlFor="note" className="text-xs text-muted-foreground font-medium">
          Descripción (opcional)
        </Label>
        <Input
          id="note"
          placeholder="Ej: supermercado, pago de sueldo…"
          {...register("note")}
          maxLength={200}
        />
      </div>

      {/* Date + future toggle row */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="date" className="text-xs text-muted-foreground font-medium">
            Fecha
          </Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
            aria-invalid={!!errors.date}
            className="text-sm"
          />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input
            id="is_future"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            checked={isFuture}
            onChange={(e) => setValue("is_future", e.target.checked)}
          />
          <Label htmlFor="is_future" className="cursor-pointer font-normal text-xs text-muted-foreground whitespace-nowrap">
            Futuro
          </Label>
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className={cn(
          "w-full press-effect font-semibold h-11",
          type === "income"
            ? "bg-success hover:bg-success/90 text-white shadow-sm shadow-success/20"
            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
        )}
        disabled={isLoading}
      >
        {isLoading ? "Guardando…" : submitLabel_resolved}
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
