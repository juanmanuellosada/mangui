"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { Zap, X, ArrowLeftRight } from "lucide-react"
import { parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { AttachmentSlot } from "@/components/ui/attachment-slot"
import { TransferForm, type TransferFormValues } from "@/components/transfers/transfer-form"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { AccountIconChip, type Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import { DOLLAR_TYPE_LABELS, type DollarType } from "@/lib/movements"
import {
  RULES_KEY,
  RULE_CONDITIONS_KEY,
  findMatchingRule,
  type AutoRule,
  type AutoRuleCondition,
} from "@/lib/rules"
import type { MovementAttachment } from "@/lib/attachments"
import { createClient } from "@/lib/supabase/client"
import { computeInstallmentAmounts } from "@/lib/installments"
import { useIsDemo } from "@/lib/use-is-demo"
import { nextCloseDate, computeDueDate, formatStatementLabel } from "@/lib/cards"

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
  // cuotas — only meaningful for expense + tarjeta_credito
  cuotas: number
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
  cuotas: z.coerce.number().int().min(1).max(60),
})

// ── Exported pending files type for parent (quick-add-provider) ──────────────

export type PendingAttachments = {
  factura: File | null
  recibo: File | null
  comprobante: File | null
}

// ── Modes for the 3-way type toggle ─────────────────────────────────────────

export type MovementMode = "income" | "expense" | "transfer"

interface MovementFormProps {
  accounts: Account[]
  categories: Category[]
  defaultValues?: Partial<MovementFormValues>
  onSubmit: (values: MovementFormValues, pending: PendingAttachments) => Promise<void>
  onTransferSubmit?: (values: TransferFormValues) => Promise<void>
  isLoading?: boolean
  transferLoading?: boolean
  submitLabel?: string
  /** When true, enables rule auto-fill on category/account. Default false (edit mode is safe). */
  isCreateMode?: boolean
  /** Edit mode: existing attachments for the movement */
  existingAttachments?: MovementAttachment[]
  /** Called after a persisted attachment is deleted (edit mode) */
  onAttachmentDeleted?: () => void
  /**
   * If provided, the 3-way toggle is shown and defaults to this mode.
   * When undefined, no transfer tab is shown (e.g. in edit mode).
   */
  initialMode?: MovementMode
}

export function MovementForm({
  accounts,
  categories,
  defaultValues,
  onSubmit,
  onTransferSubmit,
  isLoading,
  transferLoading,
  submitLabel = "Guardar",
  isCreateMode = false,
  existingAttachments,
  onAttachmentDeleted,
  initialMode,
}: MovementFormProps) {
  const today = new Date().toISOString().split("T")[0]
  const isDemo = useIsDemo()

  // 3-way mode state (only relevant when initialMode is provided)
  const [mode, setMode] = useState<MovementMode>(initialMode ?? (defaultValues?.type ?? "expense"))

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
      cuotas: 1,
      ...defaultValues,
    },
  })

  const type = watch("type")
  const amount = watch("amount")
  const originalCurrency = watch("original_currency")
  const accountId = watch("account_id")
  const dollarType = watch("dollar_type")
  const convertedAmount = watch("converted_amount")
  const note = watch("note")
  const categoryId = watch("category_id")
  const dateStr = watch("date")
  const cuotas = watch("cuotas")

  // Local state for the "Otro" cuotas custom input
  const [customCuotas, setCustomCuotas] = useState("")

  // Sync form "type" field with visual mode (when mode != transfer)
  useEffect(() => {
    if (mode === "income" || mode === "expense") {
      setValue("type", mode, { shouldValidate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── Account + currency logic (D1) ──────────────────────────────────────────

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const isCreditCard = selectedAccount?.type === "tarjeta_credito"
  const accountCurrency = selectedAccount?.currency ?? "ARS"
  const isCrossCurrency = !!originalCurrency && !!accountCurrency && originalCurrency !== accountCurrency

  // ── Cuotas / resumen summary ─────────────────────────────────────────────────
  const showCuotas = type === "expense" && isCreditCard
  const safeCuotas = showCuotas && Number.isInteger(cuotas) && cuotas >= 1 ? cuotas : 1
  const { perAmount: cuotaAmount } =
    showCuotas && safeCuotas >= 2 && amount > 0
      ? computeInstallmentAmounts(amount, safeCuotas)
      : { perAmount: 0 }

  const resumenSummary = useMemo(() => {
    if (!showCuotas) return null
    if (!selectedAccount?.closing_day) return { type: "no_closing_day" as const }

    const purchaseDate = dateStr ? parseISO(dateStr) : new Date()
    const firstClose = nextCloseDate(selectedAccount.closing_day, purchaseDate)
    const dueDay = selectedAccount.due_day ?? selectedAccount.closing_day
    const firstDue = computeDueDate(firstClose, dueDay, selectedAccount.closing_day)

    const fmt = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0")
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const yyyy = d.getFullYear()
      return `${dd}-${mm}-${yyyy}`
    }

    return {
      type: "computed" as const,
      statementLabel: formatStatementLabel(firstClose),
      closeStr: fmt(firstClose),
      dueStr: fmt(firstDue),
    }
  }, [showCuotas, dateStr, selectedAccount?.closing_day, selectedAccount?.due_day])


  // When account changes and it's not a credit card, force the currency to account's currency
  useEffect(() => {
    if (selectedAccount && !isCreditCard) {
      setValue("original_currency", selectedAccount.currency, { shouldValidate: false })
      // Clear cross-currency fields since they're irrelevant
      setValue("dollar_type", null)
      setValue("converted_amount", null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  // Reset cuotas to 1 when switching away from credit-card expense
  useEffect(() => {
    if (!showCuotas) {
      setValue("cuotas", 1, { shouldValidate: false })
      setCustomCuotas("")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCuotas])

  // ── Income/credit-card guard ───────────────────────────────────────────────
  // Ingresos cannot use credit-card accounts. When the user switches to income
  // while a credit card is selected, clear the account selection so the user
  // must pick a valid one.
  const incomeAccounts = accounts.filter((a) => a.type !== "tarjeta_credito")

  useEffect(() => {
    if (type === "income" && isCreditCard) {
      setValue("account_id", "", { shouldValidate: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  // ── Rule auto-fill (create mode only) ─────────────────────────────────────
  const [ruleHint, setRuleHint] = useState<{ ruleName: string; ruleId: string } | null>(null)
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

  useEffect(() => {
    if (!isCreateMode || activeRules.length === 0) return
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
      setRuleHint((prev) => (prev ? null : prev))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, amount, accountId, type, isCreateMode, activeRules.length, condsByRule])

  // ── Live rate preview for cross-currency ─────────────────────────────────
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
        const rate = originalCurrency === "ARS" ? data.sell : data.buy
        setLiveRate(rate)
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

  // ── Pending attachments (create mode) ─────────────────────────────────────
  const [pendingFactura, setPendingFactura] = useState<File | null>(null)
  const [pendingRecibo, setPendingRecibo] = useState<File | null>(null)
  const [pendingComprobante, setPendingComprobante] = useState<File | null>(null)

  // Reset pending files when mode changes (e.g. gasto → ingreso)
  useEffect(() => {
    setPendingFactura(null)
    setPendingRecibo(null)
    setPendingComprobante(null)
  }, [mode])

  // ── Derived helpers ───────────────────────────────────────────────────────

  const filteredCategories = categories.filter((c) => c.type === type)

  const previewConverted = (() => {
    if (!isCrossCurrency) return null
    if (convertedAmount) return convertedAmount
    if (!liveRate || !amount) return null
    return originalCurrency === "ARS"
      ? amount / liveRate
      : amount * liveRate
  })()

  // Existing attachments by kind (edit mode)
  const existingFactura = existingAttachments?.find((a) => a.kind === "factura") ?? null
  const existingRecibo = existingAttachments?.find((a) => a.kind === "recibo") ?? null
  const existingComprobante = existingAttachments?.find((a) => a.kind === "comprobante") ?? null

  // Submit handler — wraps pending files + defense-in-depth checks
  const handleFormSubmit = handleSubmit(async (values) => {
    // 3.4 — Reject currency ≠ account currency when account is not tarjeta_credito
    if (selectedAccount && selectedAccount.type !== "tarjeta_credito") {
      if (values.original_currency !== selectedAccount.currency) {
        // Force the correct currency and abort (the UI should have prevented this already)
        setValue("original_currency", selectedAccount.currency as "ARS" | "USD")
        return
      }
    }
    // Guard: income cannot use a credit-card account (UI already filters, this is defense-in-depth)
    if (values.type === "income" && selectedAccount?.type === "tarjeta_credito") {
      setValue("account_id", "")
      return
    }
    await onSubmit(values, {
      factura: pendingFactura,
      recibo: pendingRecibo,
      comprobante: pendingComprobante,
    })
    // Clear pending files on success
    setPendingFactura(null)
    setPendingRecibo(null)
    setPendingComprobante(null)
  })

  const submitLabel_resolved = submitLabel !== "Guardar"
    ? submitLabel
    : type === "income"
      ? "Guardar ingreso"
      : showCuotas && safeCuotas >= 2
        ? `Guardar en ${safeCuotas} cuotas`
        : "Guardar gasto"

  const showTransferTab = !!initialMode

  return (
    <div className="space-y-5">
      {/* 3-way type toggle (when transfer tab is enabled) */}
      {showTransferTab ? (
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {(["expense", "income", "transfer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setMode(t)
                if (t !== "transfer") {
                  setValue("type", t, { shouldValidate: true })
                  setValue("category_id", null)
                }
              }}
              className={cn(
                "flex-1 h-9 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer press-effect",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === t
                  ? t === "income"
                    ? "bg-success text-white shadow-sm"
                    : t === "expense"
                    ? "bg-destructive text-white shadow-sm"
                    : "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "income" ? "Ingreso" : t === "expense" ? "Gasto" : (
                <span className="flex items-center justify-center gap-1">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Transferencia
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        /* 2-way toggle (edit mode — no transfer tab) */
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setValue("type", t, { shouldValidate: true })
                setValue("category_id", null)
                setMode(t)
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
      )}

      {/* ── Transfer body ── */}
      {mode === "transfer" && onTransferSubmit ? (
        <TransferForm
          accounts={accounts}
          onSubmit={onTransferSubmit}
          isLoading={transferLoading}
          submitLabel="Crear transferencia"
        />
      ) : (
        /* ── Movement body ── */
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* 3.1 — Date FIRST, using MangoDatePicker */}
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

          {/* Amount — prominent, large */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs text-muted-foreground font-medium">
              {showCuotas && safeCuotas >= 2 ? "Monto total" : "Monto"}
            </Label>
            <MoneyInput
              id="amount"
              step="0.01"
              min="0.01"
              placeholder="0"
              currency={originalCurrency}
              className={cn(
                "text-2xl font-bold tabular-nums h-14 rounded-xl border-border/60",
                "focus:border-primary focus:ring-2 focus:ring-ring/30",
                type === "income" ? "focus:border-success" : "focus:border-destructive"
              )}
              wrapperClassName="w-full"
              {...register("amount")}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* 3.3 — Currency toggle only for credit cards */}
          {isCreditCard && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Moneda</Label>
              <CurrencyToggle
                value={originalCurrency}
                onChange={(v) => {
                  setValue("original_currency", v, { shouldValidate: true })
                  setValue("converted_amount", null)
                }}
                className="w-full"
              />
            </div>
          )}

          {/* Cuotas selector — only for credit card expenses */}
          {showCuotas && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-medium">Cuotas</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {([1, 3, 6, 12] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setValue("cuotas", n, { shouldValidate: false })
                      setCustomCuotas("")
                    }}
                    className={cn(
                      "h-10 w-12 rounded-xl text-sm font-bold border transition-all duration-150 cursor-pointer press-effect",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      cuotas === n && customCuotas === ""
                        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                        : "bg-muted text-muted-foreground border-transparent hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {n === 1 ? "1" : n}
                  </button>
                ))}
                <div className="flex-1 min-w-[5rem]">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    inputMode="numeric"
                    placeholder="Otro"
                    value={customCuotas}
                    onChange={(e) => {
                      const v = e.target.value
                      setCustomCuotas(v)
                      const n = parseInt(v, 10)
                      if (!isNaN(n) && n >= 1 && n <= 60) {
                        setValue("cuotas", n, { shouldValidate: false })
                      }
                    }}
                    className={cn(
                      "text-sm font-bold tabular-nums text-center",
                      customCuotas !== "" && "border-primary ring-1 ring-ring/30"
                    )}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {safeCuotas === 1 ? "Un pago" : `${safeCuotas} cuotas`}
                {safeCuotas >= 2 && amount > 0 && cuotaAmount > 0 && (
                  <> · <span className="tabular-nums font-semibold">{formatCurrency(cuotaAmount, originalCurrency)}</span> por cuota</>
                )}
              </p>
            </div>
          )}

          {/* 3.5 — Account in its own row */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Cuenta</Label>
            {/* Income: credit cards excluded; Expense: all accounts allowed */}
            <MangoSelect
              value={accountId}
              onChange={(v) => v && setValue("account_id", v, { shouldValidate: true })}
              options={(type === "income" ? incomeAccounts : accounts).map((a) => ({
                value: a.id,
                label: a.name,
                leading: <AccountIconChip icon={a.icon} />,
              }))}
              placeholder="Cuenta"
              showSearch
              aria-invalid={!!errors.account_id}
            />
            {errors.account_id && (
              <p className="text-xs text-destructive">{errors.account_id.message}</p>
            )}
          </div>

          {/* 3.5 — Category in its own row */}
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
            {/* 2.2 — showSearch on category */}
            <MangoSelect
              value={categoryId ?? "none"}
              onChange={(v) => {
                userSetCategory.current = true
                setRuleHint(null)
                setValue("category_id", v === "none" ? null : v)
              }}
              options={[
                { value: "none", label: "Sin categoría" },
                ...filteredCategories.map((c) => ({
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
              showSearch
              triggerClassName={cn(ruleHint && !userSetCategory.current && "border-primary/50 ring-1 ring-primary/20")}
            />
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

          {/* Resumen summary — credit card expenses only */}
          {showCuotas && resumenSummary && (
            <div className={cn(
              "rounded-xl border px-3 py-2.5 text-xs",
              resumenSummary.type === "computed"
                ? "border-primary/20 bg-primary/5 text-foreground"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            )}>
              {resumenSummary.type === "computed" ? (
                <p className="tabular-nums leading-relaxed">
                  {safeCuotas >= 2 && amount > 0 && cuotaAmount > 0 ? (
                    <>
                      <span className="font-semibold">{safeCuotas} cuotas de {formatCurrency(cuotaAmount, originalCurrency)}</span>
                      {" · "}
                    </>
                  ) : null}
                  Primer pago entra en el resumen de{" "}
                  <span className="font-semibold">{resumenSummary.statementLabel}</span>
                  {" "}(cierra <span className="font-semibold">{resumenSummary.closeStr}</span>
                  , vence <span className="font-semibold">{resumenSummary.dueStr}</span>)
                </p>
              ) : (
                <p>Configurá la fecha de cierre de la tarjeta para ver en qué resumen entra
                  {safeCuotas >= 2 && amount > 0 && cuotaAmount > 0 && (
                    <span className="block mt-0.5 font-semibold tabular-nums">
                      {safeCuotas} cuotas de {formatCurrency(cuotaAmount, originalCurrency)}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Cross-currency section — only for credit cards */}
          {isCrossCurrency && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                La cuenta está en{" "}
                <strong className="text-foreground">{accountCurrency}</strong> pero el movimiento
                es en{" "}
                <strong className="text-foreground">{originalCurrency}</strong> — seleccioná el tipo
                de cambio:
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="converted_amount" className="text-xs text-muted-foreground font-medium">
                  Monto en {accountCurrency}{" "}
                  {liveRate && (
                    <span className="text-muted-foreground font-normal">
                      (tipo: {formatCurrency(liveRate, "ARS").replace("$", "").trim()})
                    </span>
                  )}
                </Label>
                <MoneyInput
                  id="converted_amount"
                  step="0.01"
                  placeholder="0,00"
                  currency={accountCurrency as "ARS" | "USD"}
                  className="tabular-nums w-full"
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

          {/* 4.2 — Attachment slots by movement type */}
          {type === "expense" && (
            <div className="space-y-3">
              <AttachmentSlot
                label="Factura o ticket"
                pendingFile={pendingFactura}
                existingAttachment={existingFactura}
                onSelect={setPendingFactura}
                onClearPending={() => setPendingFactura(null)}
                onDeleted={onAttachmentDeleted}
                disabled={isLoading || isDemo}
              />
              <AttachmentSlot
                label="Recibo / comprobante de pago"
                pendingFile={pendingRecibo}
                existingAttachment={existingRecibo}
                onSelect={setPendingRecibo}
                onClearPending={() => setPendingRecibo(null)}
                onDeleted={onAttachmentDeleted}
                disabled={isLoading || isDemo}
              />
            </div>
          )}
          {type === "income" && (
            <AttachmentSlot
              label="Comprobante"
              pendingFile={pendingComprobante}
              existingAttachment={existingComprobante}
              onSelect={setPendingComprobante}
              onClearPending={() => setPendingComprobante(null)}
              onDeleted={onAttachmentDeleted}
              disabled={isLoading || isDemo}
            />
          )}

          {/* Submit */}
          <Button
            type="submit"
            className={cn(
              "w-full press-effect font-semibold h-11",
              type === "income"
                ? "bg-success hover:bg-success/90 text-white shadow-sm shadow-success/20"
                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
            )}
            disabled={isLoading || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
          >
            {isLoading ? "Guardando…" : submitLabel_resolved}
          </Button>
        </form>
      )}
    </div>
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
    cuotas: 1,
  }
}
