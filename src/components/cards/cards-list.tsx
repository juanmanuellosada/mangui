"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Plus,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { AttachmentSlot } from "@/components/ui/attachment-slot"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  listCardCycles,
  toDateString,
  formatStatementLabel,
  type CardCycle,
} from "@/lib/cards"
import {
  uploadAttachment,
  listStatementAttachments,
  type MovementAttachment,
} from "@/lib/attachments"
import { ACCOUNTS_KEY, BALANCES_KEY } from "@/lib/movements"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { InstallmentDetailBody } from "@/components/installments/installment-detail"
import { EditMovementDialog } from "@/components/movements/movements-list"
import type { Tables } from "@/lib/database.types"
import { format, parseISO, isBefore, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { useQuickAdd } from "@/components/quick-add-provider"
import { useIsDemo } from "@/lib/use-is-demo"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { ImportStatementFlow } from "@/components/cards/import-statement-flow"

type Account = Tables<"accounts">
type Movement = Tables<"movements">
type Category = Tables<"categories">
type CardStatement = Tables<"card_statements">

// ── Query keys ─────────────────────────────────────────────────────────────────

const CARD_STATEMENTS_KEY = ["card_statements"] as const

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function fetchCreditCardAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("type", "tarjeta_credito")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchMovementsForCard(accountId: string): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("account_id", accountId)
    .eq("type", "expense")
    .order("date", { ascending: false })
  if (error) throw error
  return data
}

async function fetchStatements(accountId: string): Promise<CardStatement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("card_statements")
    .select("*")
    .eq("account_id", accountId)
    .order("close_date", { ascending: false })
  if (error) throw error
  return data
}

// ── Status chip ────────────────────────────────────────────────────────────────

function CycleStatusChip({ cycle }: { cycle: CardCycle }) {
  const today = startOfDay(new Date())
  const isPaid = cycle.statement?.status === "pagado"
  const dueDate = cycle.dueDate ? parseISO(cycle.dueDate) : null
  const isOverdue = !isPaid && dueDate != null && isBefore(dueDate, today)
  const isDueToday = !isPaid && !isOverdue && dueDate != null && toDateString(dueDate) === toDateString(today)
  const isClosed = toDateString(cycle.cycleEnd) < toDateString(today)

  if (isPaid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success border border-success/20">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Pagado
      </span>
    )
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive border border-destructive/20">
        Vencido
      </span>
    )
  }
  if (isDueToday) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/20">
        Vence hoy
      </span>
    )
  }
  if (isClosed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
        Pendiente
      </span>
    )
  }
  // Open / current cycle
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
      En curso
    </span>
  )
}

// ── Card visual ────────────────────────────────────────────────────────────────

function CreditCardVisual({
  account,
  cycle,
}: {
  account: Account
  cycle: CardCycle
}) {
  const cardColor = account.color ?? "#65a30d"
  const isPaid = cycle.statement?.status === "pagado"

  // Determine whether to show dual-currency subtotals or a single total.
  // Dual: when the live cycle has both ARS and USD non-zero expenses.
  // USD-puro: el ciclo sólo tiene gastos en USD (sin equivalente en pesos) —
  // se muestra en USD, no en account.currency (que sería ARS con total 0).
  // For paid cycles we show the stored totals instead.
  const { ARS: arsTotal, USD: usdTotal } = cycle.totalsByCurrency
  const isMultiCurrency = !isPaid && arsTotal > 0 && usdTotal > 0
  const isUsdOnly = !isPaid && arsTotal === 0 && usdTotal > 0
  const singleCurrency = isUsdOnly ? "USD" : account.currency
  const singleTotal = isUsdOnly ? usdTotal : isPaid ? (cycle.statement?.total_amount ?? cycle.total) : cycle.total

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${cardColor}dd, ${cardColor}88)` }}
    >
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 bg-white" aria-hidden />
      <div className="absolute -right-4 top-8 h-20 w-20 rounded-full opacity-10 bg-white" aria-hidden />

      <div className="relative space-y-4">
        {/* Card name */}
        <div className="flex items-center justify-between">
          <p className="text-white/80 text-sm font-medium">{account.name}</p>
          <CreditCard className="h-6 w-6 text-white/60" />
        </div>

        {/* Total amount — single or dual currency */}
        <div>
          <p className="text-white/60 text-xs font-medium mb-0.5">
            Resumen · cierre {format(cycle.cycleEnd, "d MMM", { locale: es })}
          </p>
          {isMultiCurrency ? (
            <div
              className="text-white text-xl sm:text-2xl font-bold tabular-nums leading-tight flex flex-col sm:flex-row sm:items-baseline sm:gap-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span>{formatCurrency(arsTotal, "ARS")}</span>
              <span className="hidden sm:inline text-white/60 font-normal">·</span>
              <span>{formatCurrency(usdTotal, "USD")}</span>
            </div>
          ) : (
            <p
              className="text-white text-2xl sm:text-3xl font-bold tabular-nums leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatCurrency(singleTotal, singleCurrency)}
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex gap-4">
            <div>
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">Cierre</p>
              <p className="text-white text-xs font-semibold tabular-nums">
                {format(cycle.cycleEnd, "d MMM", { locale: es })}
              </p>
            </div>
            {cycle.dueDate && (
              <div>
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">Vencimiento</p>
                <p className="text-white text-xs font-semibold tabular-nums">
                  {format(parseISO(cycle.dueDate), "d MMM", { locale: es })}
                </p>
              </div>
            )}
          </div>
          <CycleStatusChip cycle={cycle} />
        </div>
      </div>
    </div>
  )
}

// ── Register payment dialog ────────────────────────────────────────────────────

function RegisterPaymentDialog({
  account,
  cycle,
  allAccounts,
  open,
  onOpenChange,
}: {
  account: Account
  cycle: CardCycle
  allAccounts: Account[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const isPaidCycle = cycle.statement?.status === "pagado"

  // Determine which currencies are present in the cycle.
  // For unpaid cycles: use live totalsByCurrency.
  // For paid cycles: use the stored statement totals.
  const { ARS: arsCycleTotal, USD: usdCycleTotal } = cycle.totalsByCurrency
  const hasARS = isPaidCycle
    ? (cycle.statement?.total_amount ?? 0) > 0
    : arsCycleTotal > 0
  const hasUSD = isPaidCycle
    ? (cycle.statement?.total_amount_usd ?? 0) > 0
    : usdCycleTotal > 0
  const isMultiCurrency = hasARS && hasUSD

  // Per-currency initial amounts
  const initialARS = isPaidCycle
    ? String((cycle.statement?.paid_amount ?? cycle.statement?.total_amount ?? arsCycleTotal).toFixed(2))
    : String(arsCycleTotal.toFixed(2))
  const initialUSD = isPaidCycle
    ? String((cycle.statement?.paid_amount_usd ?? cycle.statement?.total_amount_usd ?? usdCycleTotal).toFixed(2))
    : String(usdCycleTotal.toFixed(2))

  // For single-currency mode, use the card's own currency total
  const singleCurrency = hasUSD && !hasARS ? "USD" : account.currency
  const singleCycleTotal = singleCurrency === "USD"
    ? usdCycleTotal
    : (cycle.statement?.total_amount ?? arsCycleTotal)
  const initialSingle = isPaidCycle
    ? String((cycle.statement?.paid_amount ?? singleCycleTotal).toFixed(2))
    : String(singleCycleTotal.toFixed(2))

  // State — multi-currency
  const [paidAmountARS, setPaidAmountARS] = useState(initialARS)
  const [paidFromAccountIdARS, setPaidFromAccountIdARS] = useState(
    () => cycle.statement?.paid_from_account_id ??
      allAccounts.find((a) => a.id !== account.id && a.type !== "tarjeta_credito" && a.currency === "ARS")?.id ?? ""
  )
  const [paidAmountUSD, setPaidAmountUSD] = useState(initialUSD)
  const [paidFromAccountIdUSD, setPaidFromAccountIdUSD] = useState(
    () => cycle.statement?.paid_from_account_id_usd ??
      allAccounts.find((a) => a.id !== account.id && a.type !== "tarjeta_credito" && a.currency === "USD")?.id ?? ""
  )

  // State — single-currency (reuses the ARS slot; currency overridden by singleCurrency)
  const [paidAmountSingle, setPaidAmountSingle] = useState(initialSingle)
  const [paidFromAccountIdSingle, setPaidFromAccountIdSingle] = useState(
    () => cycle.statement?.paid_from_account_id ??
      allAccounts.find((a) => a.id !== account.id && a.type !== "tarjeta_credito")?.id ?? ""
  )

  const [paidDate, setPaidDate] = useState<Date>(new Date())
  const [pendingResumen, setPendingResumen] = useState<File | null>(null)
  const [pendingComprobante, setPendingComprobante] = useState<File | null>(null)
  const [existingResumen, setExistingResumen] = useState<MovementAttachment | null>(null)
  const [existingComprobante, setExistingComprobante] = useState<MovementAttachment | null>(null)
  const isDemo = useIsDemo()

  // Filtered account lists per currency
  const nonCardAccounts = allAccounts.filter(
    (a) => a.id !== account.id && a.type !== "tarjeta_credito"
  )
  const arsAccounts = nonCardAccounts.filter((a) => a.currency === "ARS")
  const usdAccounts = nonCardAccounts.filter((a) => a.currency === "USD")

  // Load existing attachments when viewing an already-paid cycle
  const statementId = cycle.statement?.id

  useQuery({
    queryKey: ["statement_attachments", statementId],
    queryFn: async () => {
      if (!statementId) return []
      const { data } = await listStatementAttachments(statementId)
      const resumen = data.find((a) => a.kind === "resumen") ?? null
      const comprobante = data.find((a) => a.kind === "comprobante") ?? null
      setExistingResumen(resumen)
      setExistingComprobante(comprobante)
      return data
    },
    enabled: isPaidCycle && !!statementId,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const paidDateStr = toDateString(paidDate)

      // Build the upsert payload depending on single vs multi-currency
      const upsertPayload = isMultiCurrency
        ? {
            user_id: user.id,
            account_id: account.id,
            close_date: cycle.closeDate,
            due_date: cycle.dueDate ?? cycle.closeDate,
            total_amount: arsCycleTotal,
            total_amount_usd: usdCycleTotal,
            stamp_tax: cycle.statement?.stamp_tax ?? 0,
            status: "pagado",
            paid_amount: parseFloat(paidAmountARS) || arsCycleTotal,
            paid_from_account_id: paidFromAccountIdARS || null,
            paid_amount_usd: parseFloat(paidAmountUSD) || usdCycleTotal,
            paid_from_account_id_usd: paidFromAccountIdUSD || null,
            paid_date: paidDateStr,
          }
        : {
            user_id: user.id,
            account_id: account.id,
            close_date: cycle.closeDate,
            due_date: cycle.dueDate ?? cycle.closeDate,
            total_amount: singleCurrency === "ARS" ? singleCycleTotal : 0,
            total_amount_usd: singleCurrency === "USD" ? singleCycleTotal : 0,
            stamp_tax: cycle.statement?.stamp_tax ?? 0,
            status: "pagado",
            paid_amount: singleCurrency === "ARS" ? (parseFloat(paidAmountSingle) || singleCycleTotal) : null,
            paid_from_account_id: singleCurrency === "ARS" ? (paidFromAccountIdSingle || null) : null,
            paid_amount_usd: singleCurrency === "USD" ? (parseFloat(paidAmountSingle) || singleCycleTotal) : null,
            paid_from_account_id_usd: singleCurrency === "USD" ? (paidFromAccountIdSingle || null) : null,
            paid_date: paidDateStr,
          }

      const { data: stmt, error } = await supabase
        .from("card_statements")
        .upsert(upsertPayload, { onConflict: "account_id,close_date" })
        .select()
        .single()
      if (error) throw error

      const newStatementId = stmt.id

      // Upload pending attachments
      const uploads: Array<{ file: File; kind: "resumen" | "comprobante" }> = []
      if (pendingResumen) uploads.push({ file: pendingResumen, kind: "resumen" })
      if (pendingComprobante) uploads.push({ file: pendingComprobante, kind: "comprobante" })

      for (const { file, kind } of uploads) {
        const result = await uploadAttachment({
          file,
          userId: user.id,
          kind,
          statementId: newStatementId,
        })
        if (result.error) {
          toast.warning(`Pago registrado, pero no se pudo subir "${file.name}": ${result.error}`)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARD_STATEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      toast.success("Pago registrado")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al registrar el pago", { description: err.message })
    },
  })

  const isDisabled = mutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {account.name}
            {" · "}cierre {format(cycle.cycleEnd, "d MMM", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isMultiCurrency ? (
            /* ── Multi-currency: two sections separated by a divider ── */
            <>
              {/* ARS section */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Pesos (ARS)
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Monto pagado</Label>
                  <MoneyInput
                    step="0.01"
                    currency="ARS"
                    value={paidAmountARS}
                    onChange={(e) => setPaidAmountARS(e.target.value)}
                    disabled={isDisabled}
                    className="tabular-nums font-semibold w-full"
                  />
                </div>
                {arsAccounts.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Pagado desde</Label>
                    <MangoSelect
                      value={paidFromAccountIdARS}
                      onChange={(v) => setPaidFromAccountIdARS(v ?? "")}
                      options={[
                        { value: "", label: "Sin especificar" },
                        ...arsAccounts.map((a) => ({
                          value: a.id,
                          label: a.name,
                          leading: <AccountIconChip icon={a.icon} />,
                        })),
                      ]}
                      placeholder="Cuenta en pesos"
                      showSearch
                      disabled={isDisabled}
                    />
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="border-t border-border/60" />

              {/* USD section */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Dólares (USD)
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Monto pagado</Label>
                  <MoneyInput
                    step="0.01"
                    currency="USD"
                    value={paidAmountUSD}
                    onChange={(e) => setPaidAmountUSD(e.target.value)}
                    disabled={isDisabled}
                    className="tabular-nums font-semibold w-full"
                  />
                </div>
                {usdAccounts.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Pagado desde</Label>
                    <MangoSelect
                      value={paidFromAccountIdUSD}
                      onChange={(v) => setPaidFromAccountIdUSD(v ?? "")}
                      options={[
                        { value: "", label: "Sin especificar" },
                        ...usdAccounts.map((a) => ({
                          value: a.id,
                          label: a.name,
                          leading: <AccountIconChip icon={a.icon} />,
                        })),
                      ]}
                      placeholder="Cuenta en dólares"
                      showSearch
                      disabled={isDisabled}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Single-currency: original layout ── */
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Monto pagado</Label>
                <MoneyInput
                  step="0.01"
                  currency={singleCurrency}
                  value={paidAmountSingle}
                  onChange={(e) => setPaidAmountSingle(e.target.value)}
                  disabled={isDisabled}
                  className="tabular-nums font-semibold w-full"
                />
              </div>

              {nonCardAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Pagado desde</Label>
                  <MangoSelect
                    value={paidFromAccountIdSingle}
                    onChange={(v) => setPaidFromAccountIdSingle(v ?? "")}
                    options={[
                      { value: "", label: "Sin especificar" },
                      ...nonCardAccounts.map((a) => ({
                        value: a.id,
                        label: a.name,
                        leading: <AccountIconChip icon={a.icon} />,
                      })),
                    ]}
                    placeholder="Cuenta origen"
                    showSearch
                    disabled={isDisabled}
                  />
                </div>
              )}
            </>
          )}

          {/* Date — shared */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Fecha de pago</Label>
            <MangoDatePicker
              value={paidDate}
              onChange={(d) => setPaidDate(d)}
            />
          </div>

          {/* Summary info */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
            {isMultiCurrency ? (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total pesos</span>
                  <span className="tabular-nums font-semibold">{formatCurrency(arsCycleTotal, "ARS")}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total dólares</span>
                  <span className="tabular-nums font-semibold">{formatCurrency(usdCycleTotal, "USD")}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total resumen</span>
                <span className="tabular-nums font-semibold">
                  {formatCurrency(singleCycleTotal, singleCurrency)}
                </span>
              </div>
            )}
            {cycle.dueDate && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Vencimiento</span>
                <span className="tabular-nums">
                  {format(parseISO(cycle.dueDate), "d MMM yyyy", { locale: es })}
                </span>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <AttachmentSlot
              label="Resumen (PDF/imagen)"
              pendingFile={pendingResumen}
              existingAttachment={existingResumen}
              onSelect={(f) => setPendingResumen(f)}
              onClearPending={() => setPendingResumen(null)}
              onDeleted={() => setExistingResumen(null)}
              disabled={isDisabled}
            />
            <AttachmentSlot
              label="Comprobante de pago"
              pendingFile={pendingComprobante}
              existingAttachment={existingComprobante}
              onSelect={(f) => setPendingComprobante(f)}
              onClearPending={() => setPendingComprobante(null)}
              onDeleted={() => setExistingComprobante(null)}
              disabled={isDisabled}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDisabled}
            className="flex-1 cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={isDisabled || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            className="flex-1 press-effect cursor-pointer"
          >
            {isDisabled ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Card block ─────────────────────────────────────────────────────────────────

function CardBlock({
  account,
  allAccounts,
  categories,
}: {
  account: Account
  allAccounts: Account[]
  categories: Category[]
}) {
  const { open: openQuickAdd } = useQuickAdd()

  // Key starts with "movements" so invalidating MOVEMENTS_KEY in QuickAddProvider
  // (after creating/editing a movement) also refreshes this query automatically.
  const { data: movements = [] } = useQuery({
    queryKey: ["movements", "card", account.id],
    queryFn: () => fetchMovementsForCard(account.id),
  })

  const { data: statements = [] } = useQuery({
    queryKey: [...CARD_STATEMENTS_KEY, account.id],
    queryFn: () => fetchStatements(account.id),
  })

  const cycles = useMemo(
    () => listCardCycles(account.id, account, movements, statements),
    [account, movements, statements]
  )

  // Default to current open cycle = last element
  const defaultIndex = cycles.length > 0 ? cycles.length - 1 : 0
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex)

  // Keep selectedIndex clamped if cycles list changes length
  const safeIndex = Math.min(selectedIndex, Math.max(0, cycles.length - 1))

  const cycle = cycles[safeIndex]

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cuotaDetailId, setCuotaDetailId] = useState<string | null>(null)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  const handlePrev = useCallback(() => setSelectedIndex((i) => Math.max(0, i - 1)), [])
  const handleNext = useCallback(
    () => setSelectedIndex((i) => Math.min(cycles.length - 1, i + 1)),
    [cycles.length]
  )

  const handleAddExpense = useCallback(() => {
    if (!cycle) return
    // Preset account + a date within the cycle (use cycleEnd as the representative date)
    const presetDate = toDateString(cycle.cycleEnd)
    openQuickAdd("movement", "expense", {
      account_id: account.id,
      date: presetDate,
    })
  }, [cycle, account.id, openQuickAdd])

  // Unified list: all expense movements sorted by date ascending.
  // Hook must run unconditionally (before the early return below), so it
  // tolerates a missing cycle by falling back to an empty array.
  const allCycleMovements = useMemo(
    () =>
      cycle
        ? [...cycle.movements].sort((a, b) =>
            (a as Movement).date.localeCompare((b as Movement).date)
          )
        : [],
    [cycle]
  )

  if (!cycle) return null

  const isPaid = cycle.statement?.status === "pagado"
  const today = startOfDay(new Date())

  // "A pagar" block for the selected cycle
  const dueDate = cycle.dueDate ? parseISO(cycle.dueDate) : null
  const isOverdue = !isPaid && dueDate != null && isBefore(dueDate, today)
  const isDueToday = !isPaid && !isOverdue && dueDate != null && toDateString(dueDate) === toDateString(today)

  const { ARS: arsTotal, USD: usdTotal } = cycle.totalsByCurrency
  const isMultiCurrency = !isPaid && arsTotal > 0 && usdTotal > 0
  // USD-puro: el ciclo sólo tiene gastos en USD sin equivalente en pesos —
  // se muestra en USD (account.currency sería ARS con total 0).
  const isUsdOnly = !isPaid && arsTotal === 0 && usdTotal > 0
  const displayCurrency = isUsdOnly ? "USD" : account.currency
  const displayTotal = isUsdOnly ? usdTotal : isPaid ? (cycle.statement?.total_amount ?? cycle.total) : cycle.total

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
      {/* Card visual */}
      <div className="p-4 pb-0">
        <CreditCardVisual account={account} cycle={cycle} />
      </div>

      {/* Cycle navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={safeIndex === 0}
          aria-label="Resumen anterior"
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold",
            "transition-colors duration-150 cursor-pointer press-effect",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold text-foreground tabular-nums">
            {formatStatementLabel(cycle.cycleEnd)}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {safeIndex + 1} / {cycles.length}
          </p>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={safeIndex === cycles.length - 1}
          aria-label="Resumen siguiente"
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold",
            "transition-colors duration-150 cursor-pointer press-effect",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 space-y-4">
        {/* A pagar block */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">A pagar</p>
          <div className="flex items-start sm:items-end justify-between gap-2">
            {isMultiCurrency ? (
              <div
                className="text-lg sm:text-xl font-bold tabular-nums leading-tight text-foreground flex flex-col sm:flex-row sm:items-baseline sm:gap-2 min-w-0"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span>{formatCurrency(arsTotal, "ARS")}</span>
                <span className="hidden sm:inline text-muted-foreground font-normal text-base">·</span>
                <span>{formatCurrency(usdTotal, "USD")}</span>
              </div>
            ) : (
              <p
                className={cn(
                  "text-xl sm:text-2xl font-bold tabular-nums leading-none",
                  isOverdue ? "text-destructive" : "text-foreground"
                )}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {formatCurrency(displayTotal, displayCurrency)}
              </p>
            )}
            {isPaid && cycle.statement?.paid_date && (
              <p className="text-xs font-semibold text-success pb-0.5 flex-shrink-0 whitespace-nowrap">
                Pagado {format(parseISO(cycle.statement.paid_date), "d MMM", { locale: es })}
              </p>
            )}
            {!isPaid && dueDate != null && (
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums pb-0.5 flex-shrink-0 whitespace-nowrap",
                  isOverdue
                    ? "text-destructive"
                    : isDueToday
                    ? "text-amber-500"
                    : "text-muted-foreground"
                )}
              >
                {isOverdue
                  ? "Vencido"
                  : isDueToday
                  ? "Vence hoy"
                  : `Vence ${format(dueDate, "d MMM", { locale: es })}`}
              </p>
            )}
          </div>
        </div>

        {/* Unified gastos del resumen */}
        {allCycleMovements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Gastos del resumen
              </p>
              <Link
                href={`/movimientos?account=${account.id}`}
                className="text-xs text-primary hover:underline font-medium"
              >
                Ver todos
              </Link>
            </div>
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
              {allCycleMovements.slice(0, 8).map((m) => {
                const mv = m as Movement
                const cat = mv.category_id ? categoryMap.get(mv.category_id) : undefined
                const isCuota = mv.installment_purchase_id !== null
                return isCuota ? (
                  <button
                    key={mv.id}
                    type="button"
                    onClick={() => setCuotaDetailId(mv.installment_purchase_id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left",
                      "hover:bg-muted/40 transition-colors duration-150 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      mv.is_future && "opacity-70"
                    )}
                  >
                    <CategoryIconChip icon={cat?.icon} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {cat?.name ?? "Sin categoría"}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground flex-shrink-0">
                          {mv.installment_number}/{mv.installment_total}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {format(parseISO(mv.date), "d MMM", { locale: es })}
                        {mv.note ? ` · ${mv.note}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
                      − {formatCurrency(mv.amount, mv.original_currency)}
                    </p>
                  </button>
                ) : (
                  <button
                    key={mv.id}
                    type="button"
                    onClick={() => setEditingMovement(mv)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left",
                      "hover:bg-muted/40 transition-colors duration-150 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    )}
                  >
                    <CategoryIconChip icon={cat?.icon} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {cat?.name ?? "Sin categoría"}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {format(parseISO(mv.date), "d MMM", { locale: es })}
                        {mv.note ? ` · ${mv.note}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
                      − {formatCurrency(mv.amount, mv.original_currency)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {allCycleMovements.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            Sin gastos en este resumen.
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {isPaid ? (
            <div className="flex-1 flex items-center gap-2 justify-center py-2.5 rounded-xl bg-success/10 border border-success/20 flex-wrap">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <p className="text-sm font-semibold text-success">
                Pago registrado
                {cycle.statement?.paid_amount != null && cycle.statement.paid_amount > 0
                  ? ` — ${formatCurrency(cycle.statement.paid_amount, "ARS")}`
                  : ""}
                {cycle.statement?.paid_amount_usd != null && cycle.statement.paid_amount_usd > 0
                  ? ` · ${formatCurrency(cycle.statement.paid_amount_usd, "USD")}`
                  : ""}
              </p>
              {/* Allow viewing/editing attachments on paid cycle */}
              <button
                type="button"
                onClick={() => setPaymentOpen(true)}
                className="ml-1 text-[10px] text-success/70 hover:text-success underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Ver adjuntos
              </button>
            </div>
          ) : (
            <>
              <Button
                onClick={() => setPaymentOpen(true)}
                className="flex-1 press-effect font-semibold h-10 cursor-pointer"
              >
                Registrar pago
              </Button>
              <Button
                variant="outline"
                onClick={handleAddExpense}
                className="flex items-center gap-1.5 h-10 px-3 press-effect cursor-pointer"
                aria-label="Agregar gasto a este resumen"
              >
                <Plus className="h-4 w-4" />
                Gasto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Payment dialog */}
      {paymentOpen && (
        <RegisterPaymentDialog
          account={account}
          cycle={cycle}
          allAccounts={allAccounts}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
        />
      )}

      {/* Cuota detail modal */}
      <MangoSheet
        open={cuotaDetailId !== null}
        onOpenChange={(v) => { if (!v) setCuotaDetailId(null) }}
        title="Detalle de cuotas"
      >
        {cuotaDetailId && (
          <InstallmentDetailBody
            purchaseId={cuotaDetailId}
            cardAccount={account}
            cardStatements={statements}
            accounts={allAccounts}
            categories={categories}
          />
        )}
      </MangoSheet>

      {/* Edit regular movement modal */}
      {editingMovement && (
        <EditMovementDialog
          movement={editingMovement}
          accounts={allAccounts}
          categories={categories}
          open={editingMovement !== null}
          onOpenChange={(v) => { if (!v) setEditingMovement(null) }}
        />
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CardBlockSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm p-4 space-y-4">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CardsList() {
  const { data: cards, isLoading: loadingCards } = useQuery({
    queryKey: ["credit_card_accounts"],
    queryFn: fetchCreditCardAccounts,
  })

  const { data: allAccounts = [] } = useAccounts()

  const { data: categories = [] } = useCategories()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className="text-2xl md:text-3xl tracking-tight font-bold truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tarjetas
          </h1>
          {cards && cards.length > 1 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {cards.length} tarjetas
            </span>
          )}
        </div>
        <ImportStatementFlow cardAccounts={cards ?? []} categories={categories} />
      </div>

      {/* Loading */}
      {loadingCards && (
        <div className="space-y-4">
          <CardBlockSkeleton />
          <CardBlockSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!loadingCards && (!cards || cards.length === 0) && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              No tenés tarjetas de crédito
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Agregá una tarjeta de crédito en tus cuentas para ver los resúmenes y cuotas.
            </p>
          </div>
          <Link
            href="/cuentas"
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold",
              "bg-primary text-primary-foreground shadow-sm shadow-primary/20 press-effect cursor-pointer",
              "hover:bg-primary/90 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Plus className="h-4 w-4" />
            Agregar cuenta
          </Link>
        </div>
      )}

      {/* Vertical list of card blocks */}
      {!loadingCards && cards && cards.length > 0 && (
        <div className="space-y-4">
          {cards.map((card) => (
            <CardBlock
              key={card.id}
              account={card}
              allAccounts={allAccounts}
              categories={categories}
            />
          ))}
        </div>
      )}
    </div>
  )
}
