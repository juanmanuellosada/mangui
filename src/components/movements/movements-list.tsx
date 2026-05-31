"use client"

import { useState, useCallback, useMemo, useTransition } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  X,
  SlidersHorizontal,
  Clock,
  Search,
  CreditCard,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MovementForm, movementToFormValues, type MovementFormValues } from "./movement-form"
import { TransferForm, transferToFormValues, type TransferFormValues } from "@/components/transfers/transfer-form"
import { InstallmentForm, type InstallmentFormValues } from "@/components/installments/installment-form"
import { AiQuickAddSheet } from "@/components/ai/ai-quick-add-sheet"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  TRANSFERS_KEY,
  ACCOUNTS_KEY,
  BALANCES_KEY,
  CATEGORIES_KEY,
} from "@/lib/movements"
import { INSTALLMENTS_KEY, computeInstallmentAmounts, computeInstallmentDate, isInstallmentFuture } from "@/lib/installments"
import { fetchDolarRates } from "@/lib/rates/dolar"
import type { DollarType } from "@/lib/movements"
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"

type Movement = Tables<"movements">
type Transfer = Tables<"transfers">
type Category = Tables<"categories">

// Discriminated union for unified feed
type FeedItem =
  | { kind: "movement"; item: Movement }
  | { kind: "transfer"; item: Transfer }

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

async function fetchTransfers(): Promise<Transfer[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
  if (error) throw error
  return data
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return "Hoy"
  if (isYesterday(date)) return "Ayer"
  return format(date, "EEE d MMM", { locale: es })
}

// ── Movement row ──────────────────────────────────────────────────────────────

function MovementRow({
  movement,
  account,
  category,
  onEdit,
  onDelete,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  onEdit: (m: Movement) => void
  onDelete: (m: Movement) => void
}) {
  const isIncome = movement.type === "income"
  const displayAmount = movement.converted_amount ?? movement.amount
  const displayCurrency = account?.currency ?? movement.original_currency
  const isCross = movement.converted_amount !== null
  const isCuota = movement.installment_purchase_id !== null

  return (
    <div className="flex items-center gap-3 py-3 group">
      {/* Icon */}
      <div
        className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
          isIncome ? "bg-success/10" : "bg-destructive/10"
        )}
      >
        {isIncome ? (
          <ArrowUpCircle className="h-4.5 w-4.5 text-success" style={{ width: "1.125rem", height: "1.125rem" }} />
        ) : (
          <ArrowDownCircle className="h-4.5 w-4.5 text-destructive" style={{ width: "1.125rem", height: "1.125rem" }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <p className="text-sm font-medium truncate">
            {category?.name ?? "Sin categoría"}
          </p>
          {movement.is_future && (
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          {isCuota && movement.installment_number !== null && movement.installment_total !== null && (
            <Link
              href={`/app/cuotas/${movement.installment_purchase_id}`}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0 rounded-md text-[10px] font-bold",
                "bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              Cuota {movement.installment_number}/{movement.installment_total}
            </Link>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {account?.name ?? "—"}
          {movement.note ? ` · ${movement.note}` : ""}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isIncome ? "text-success" : "text-destructive"
          )}
        >
          {isIncome ? "+ " : "− "}
          {formatCurrency(displayAmount, displayCurrency)}
        </p>
        {isCross && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatCurrency(movement.amount, movement.original_currency)}
          </p>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Editar"
          className="press-effect cursor-pointer"
          onClick={() => onEdit(movement)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Eliminar"
          className="press-effect cursor-pointer"
          onClick={() => onDelete(movement)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ── Transfer row ──────────────────────────────────────────────────────────────

function TransferRow({
  transfer,
  fromAccount,
  toAccount,
  onEdit,
  onDelete,
}: {
  transfer: Transfer
  fromAccount: Account | undefined
  toAccount: Account | undefined
  onEdit: (t: Transfer) => void
  onDelete: (t: Transfer) => void
}) {
  const isCross =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  return (
    <div className="flex items-center gap-3 py-3 group">
      {/* Icon — neutral */}
      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-medium truncate">
            Transferencia
          </p>
          {transfer.is_future && (
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {fromAccount?.name ?? "—"} → {toAccount?.name ?? "—"}
          {transfer.note ? ` · ${transfer.note}` : ""}
        </p>
      </div>

      {/* Amounts */}
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="text-sm font-semibold tabular-nums text-muted-foreground">
          −{formatCurrency(transfer.from_amount, fromAccount?.currency ?? "ARS")}
        </p>
        {isCross && (
          <p className="text-[10px] tabular-nums text-muted-foreground">
            +{formatCurrency(transfer.to_amount, toAccount?.currency ?? "ARS")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Editar"
          className="press-effect cursor-pointer"
          onClick={() => onEdit(transfer)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Eliminar"
          className="press-effect cursor-pointer"
          onClick={() => onDelete(transfer)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ── Filters panel ─────────────────────────────────────────────────────────────

function FiltersPanel({
  accounts,
  categories,
  onClose,
}: {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams]
  )

  const typeValue = searchParams.get("type") ?? "all"
  const accountValue = searchParams.get("account") ?? "all"
  const categoryValue = searchParams.get("category") ?? "all"
  const dateFrom = searchParams.get("from") ?? ""
  const dateTo = searchParams.get("to") ?? ""
  const searchValue = searchParams.get("q") ?? ""

  const hasFilters =
    typeValue !== "all" ||
    accountValue !== "all" ||
    categoryValue !== "all" ||
    dateFrom ||
    dateTo ||
    searchValue

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Filtros</p>
        </div>
        <div className="flex items-center gap-1">
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  router.push(pathname, { scroll: false })
                })
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Account */}
        <div className="space-y-1.5">
          <Label className="text-xs">Cuenta</Label>
          <Select
            value={accountValue}
            onValueChange={(v) => updateParam("account", v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs">Categoría</Label>
          <Select
            value={categoryValue}
            onValueChange={(v) => updateParam("category", v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date from */}
        <div className="space-y-1.5">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => updateParam("from", e.target.value || null)}
            className="text-xs"
          />
        </div>

        {/* Date to */}
        <div className="space-y-1.5">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => updateParam("to", e.target.value || null)}
            className="text-xs"
          />
        </div>

        {/* Search */}
        <div className="space-y-1.5 col-span-2 sm:col-span-2">
          <Label className="text-xs">Buscar en nota</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar…"
              value={searchValue}
              onChange={(e) => updateParam("q", e.target.value || null)}
              className="text-xs pl-8"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quick-add menu ─────────────────────────────────────────────────────────────

type QuickAddMode = "movement" | "transfer" | "installment" | "ai"

async function createInstallmentPurchaseWithMovements(
  values: InstallmentFormValues,
  accounts: Account[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const account = accounts.find((a) => a.id === values.account_id)
  const accountCurrency = account?.currency ?? "ARS"
  const isCross = values.currency !== accountCurrency

  // Fetch rate once if cross-currency
  let rateValue: number | null = null
  if (isCross && values.dollar_type && values.dollar_type !== "tarjeta") {
    try {
      const rates = await fetchDolarRates()
      const rateKey = values.dollar_type as Exclude<DollarType, "tarjeta">
      const rateData = rates[rateKey]
      if (rateData) {
        rateValue = values.currency === "ARS" ? rateData.sell : rateData.buy
      }
    } catch {
      // proceed without rate
    }
  }

  // 1. INSERT installment_purchases
  const { data: purchase, error: purchaseError } = await supabase
    .from("installment_purchases")
    .insert({
      user_id: user.id,
      description: values.description,
      total_amount: values.total_amount,
      installments_count: values.installments_count,
      start_date: values.start_date,
      account_id: values.account_id,
      category_id: values.category_id,
      currency: values.currency,
      dollar_type: isCross ? values.dollar_type : null,
    })
    .select()
    .single()

  if (purchaseError) throw purchaseError

  // 2. Compute per-cuota amounts
  const { perAmount, lastAmount } = computeInstallmentAmounts(
    values.total_amount,
    values.installments_count
  )

  // 3. Build N movement rows
  const movementRows = []
  for (let i = 1; i <= values.installments_count; i++) {
    const cuotaDate = computeInstallmentDate(values.start_date, i)
    const isFuture = isInstallmentFuture(cuotaDate)
    const cuotaAmount = i === values.installments_count ? lastAmount : perAmount

    let convertedAmount: number | null = null
    if (isCross && rateValue !== null) {
      const raw = values.currency === "ARS" ? cuotaAmount / rateValue : cuotaAmount * rateValue
      convertedAmount = Math.round(raw * 100) / 100
    }

    movementRows.push({
      user_id: user.id,
      type: "expense" as const,
      amount: cuotaAmount,
      original_currency: values.currency,
      account_id: values.account_id,
      category_id: values.category_id,
      date: cuotaDate,
      is_future: isFuture,
      installment_purchase_id: purchase.id,
      installment_number: i,
      installment_total: values.installments_count,
      dollar_type: isCross ? values.dollar_type : null,
      converted_amount: convertedAmount,
      note: null,
    })
  }

  // 4. INSERT all movements in a single call
  const { error: movError } = await supabase.from("movements").insert(movementRows)
  if (movError) throw movError
}

function QuickAddMenu({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<QuickAddMode>("movement")
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense")
  const [menuOpen, setMenuOpen] = useState(false)
  const queryClient = useQueryClient()

  const movementMutation = useMutation({
    mutationFn: async (values: MovementFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency
      const { data, error } = await supabase
        .from("movements")
        .insert({
          user_id: user.id,
          type: values.type,
          amount: values.amount,
          original_currency: values.original_currency,
          account_id: values.account_id,
          category_id: values.category_id,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento creado")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el movimiento", { description: err.message })
    },
  })

  const transferMutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data, error } = await supabase
        .from("transfers")
        .insert({
          user_id: user.id,
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          from_amount: values.from_amount,
          to_amount: values.to_amount,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la transferencia", { description: err.message })
    },
  })

  const installmentMutation = useMutation({
    mutationFn: (values: InstallmentFormValues) =>
      createInstallmentPurchaseWithMovements(values, accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
      toast.success("Compra en cuotas creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear las cuotas", { description: err.message })
    },
  })

  const openDialog = (m: QuickAddMode, type?: "income" | "expense") => {
    setMode(m)
    if (type) setDefaultType(type)
    setMenuOpen(false)
    setOpen(true)
  }

  if (!accounts.length) return null

  return (
    <>
      {/* Trigger + dropdown menu */}
      <div className="relative">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => openDialog("movement", "expense")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-l-lg border-r-0 px-2.5 text-sm font-semibold",
              "bg-primary text-primary-foreground border border-transparent",
              "shadow-sm shadow-primary/20 press-effect",
              "hover:bg-primary/80 transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center px-1.5 rounded-r-lg",
              "bg-primary text-primary-foreground border border-transparent border-l border-primary-foreground/20",
              "shadow-sm shadow-primary/20 press-effect",
              "hover:bg-primary/80 transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="Opciones de nuevo registro"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => openDialog("movement", "income")}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <ArrowUpCircle className="h-4 w-4 text-success flex-shrink-0" />
                <span className="font-medium">Ingreso</span>
              </button>
              <button
                type="button"
                onClick={() => openDialog("movement", "expense")}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <ArrowDownCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <span className="font-medium">Gasto</span>
              </button>
              <div className="h-px bg-border/60 mx-2" />
              <button
                type="button"
                onClick={() => openDialog("transfer")}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">Transferencia</span>
              </button>
              <div className="h-px bg-border/60 mx-2" />
              <button
                type="button"
                onClick={() => openDialog("installment")}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">Gasto en cuotas</span>
              </button>
              <div className="h-px bg-border/60 mx-2" />
              <button
                type="button"
                onClick={() => openDialog("ai")}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">Cargar con IA</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* AI Quick Add Sheet — rendered outside the dropdown */}
      <AiQuickAddSheet
        open={open && mode === "ai"}
        onOpenChange={(v) => { if (!v) setOpen(false) }}
        accounts={accounts}
        categories={categories}
      />

      {/* Dialog */}
      <Dialog open={open && mode !== "ai"} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {mode === "movement" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {defaultType === "income" ? "Nuevo ingreso" : "Nuevo gasto"}
                </DialogTitle>
                <DialogDescription>
                  Registrá un movimiento en una de tus cuentas.
                </DialogDescription>
              </DialogHeader>
              <MovementForm
                accounts={accounts}
                categories={categories}
                defaultValues={{ type: defaultType }}
                onSubmit={async (v) => { await movementMutation.mutateAsync(v) }}
                isLoading={movementMutation.isPending}
                submitLabel="Crear movimiento"
                isCreateMode
              />
            </>
          ) : mode === "transfer" ? (
            <>
              <DialogHeader>
                <DialogTitle>Nueva transferencia</DialogTitle>
                <DialogDescription>
                  Mové saldo entre tus cuentas.
                </DialogDescription>
              </DialogHeader>
              <TransferForm
                accounts={accounts}
                onSubmit={async (v) => { await transferMutation.mutateAsync(v) }}
                isLoading={transferMutation.isPending}
                submitLabel="Crear transferencia"
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Nuevo gasto en cuotas</DialogTitle>
                <DialogDescription>
                  Dividí una compra en cuotas mensuales.
                </DialogDescription>
              </DialogHeader>
              <InstallmentForm
                accounts={accounts}
                categories={categories}
                onSubmit={async (v) => { await installmentMutation.mutateAsync(v) }}
                isLoading={installmentMutation.isPending}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Mobile FAB ─────────────────────────────────────────────────────────────────

function FABQuickAdd({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<QuickAddMode>("movement")
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense")
  const queryClient = useQueryClient()

  const movementMutation = useMutation({
    mutationFn: async (values: MovementFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency
      const { data, error } = await supabase
        .from("movements")
        .insert({
          user_id: user.id,
          type: values.type,
          amount: values.amount,
          original_currency: values.original_currency,
          account_id: values.account_id,
          category_id: values.category_id,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento creado")
      setDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el movimiento", { description: err.message })
    },
  })

  const transferMutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data, error } = await supabase
        .from("transfers")
        .insert({
          user_id: user.id,
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          from_amount: values.from_amount,
          to_amount: values.to_amount,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia creada")
      setDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la transferencia", { description: err.message })
    },
  })

  const installmentMutation = useMutation({
    mutationFn: (values: InstallmentFormValues) =>
      createInstallmentPurchaseWithMovements(values, accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
      toast.success("Compra en cuotas creada")
      setDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear las cuotas", { description: err.message })
    },
  })

  const openDialog = (m: QuickAddMode, type?: "income" | "expense") => {
    setMode(m)
    if (type) setDefaultType(type)
    setMenuOpen(false)
    setDialogOpen(true)
  }

  if (!accounts.length) return null

  return (
    <>
      {/* FAB + mini action menu */}
      <div className="lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] right-4 z-30 flex flex-col items-end gap-2">
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="relative z-20 flex flex-col items-end gap-2">
              {(
                [
                  { m: "movement" as const, type: "income" as const, icon: ArrowUpCircle, label: "Ingreso", color: "bg-success text-white" },
                  { m: "movement" as const, type: "expense" as const, icon: ArrowDownCircle, label: "Gasto", color: "bg-destructive text-white" },
                  { m: "transfer" as const, type: undefined, icon: ArrowLeftRight, label: "Transferencia", color: "bg-muted-foreground text-white" },
                  { m: "installment" as const, type: undefined, icon: CreditCard, label: "En cuotas", color: "bg-primary text-primary-foreground" },
                  { m: "ai" as const, type: undefined, icon: Sparkles, label: "Cargar con IA", color: "bg-primary/80 text-primary-foreground" },
                ] as const
              ).map(({ m, type, icon: Icon, label, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => openDialog(m, type as "income" | "expense" | undefined)}
                  className={cn(
                    "flex items-center gap-2 h-11 px-4 rounded-full shadow-md press-effect",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    color
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "w-14 h-14 rounded-full bg-primary text-primary-foreground",
            "shadow-lg shadow-primary/35 press-effect relative z-20",
            "flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            menuOpen && "rotate-45 transition-transform duration-150"
          )}
          aria-label="Agregar"
        >
          <PlusCircle className="h-6 w-6" />
        </button>
      </div>

      {/* AI Quick Add Sheet */}
      <AiQuickAddSheet
        open={dialogOpen && mode === "ai"}
        onOpenChange={(v) => { if (!v) setDialogOpen(false) }}
        accounts={accounts}
        categories={categories}
      />

      {/* Dialog (non-AI modes) */}
      <Dialog open={dialogOpen && mode !== "ai"} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {mode === "movement" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {defaultType === "income" ? "Nuevo ingreso" : "Nuevo gasto"}
                </DialogTitle>
                <DialogDescription>
                  Registrá un movimiento en una de tus cuentas.
                </DialogDescription>
              </DialogHeader>
              <MovementForm
                accounts={accounts}
                categories={categories}
                defaultValues={{ type: defaultType }}
                onSubmit={async (v) => { await movementMutation.mutateAsync(v) }}
                isLoading={movementMutation.isPending}
                submitLabel="Crear movimiento"
                isCreateMode
              />
            </>
          ) : mode === "transfer" ? (
            <>
              <DialogHeader>
                <DialogTitle>Nueva transferencia</DialogTitle>
                <DialogDescription>
                  Mové saldo entre tus cuentas.
                </DialogDescription>
              </DialogHeader>
              <TransferForm
                accounts={accounts}
                onSubmit={async (v) => { await transferMutation.mutateAsync(v) }}
                isLoading={transferMutation.isPending}
                submitLabel="Crear transferencia"
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Nuevo gasto en cuotas</DialogTitle>
                <DialogDescription>
                  Dividí una compra en cuotas mensuales.
                </DialogDescription>
              </DialogHeader>
              <InstallmentForm
                accounts={accounts}
                categories={categories}
                onSubmit={async (v) => { await installmentMutation.mutateAsync(v) }}
                isLoading={installmentMutation.isPending}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Edit/Delete dialogs for transfers ─────────────────────────────────────────

function EditTransferDialog({
  transfer,
  accounts,
  open,
  onOpenChange,
}: {
  transfer: Transfer
  accounts: Account[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("transfers")
        .update({
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          from_amount: values.from_amount,
          to_amount: values.to_amount,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transfer.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: TRANSFERS_KEY })
      const previous = queryClient.getQueryData<Transfer[]>(TRANSFERS_KEY)
      queryClient.setQueryData<Transfer[]>(TRANSFERS_KEY, (old = []) =>
        old.map((t) =>
          t.id === transfer.id
            ? {
                ...t,
                from_account_id: values.from_account_id,
                to_account_id: values.to_account_id,
                from_amount: values.from_amount,
                to_amount: values.to_amount,
                date: values.date,
                note: values.note || null,
                is_future: values.is_future,
              }
            : t
        )
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(TRANSFERS_KEY, context.previous)
      toast.error("Error al actualizar la transferencia", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia actualizada")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar transferencia</DialogTitle>
          <DialogDescription>Modificá los datos de la transferencia.</DialogDescription>
        </DialogHeader>
        <TransferForm
          accounts={accounts}
          defaultValues={transferToFormValues(transfer)}
          onSubmit={async (v) => { await mutation.mutateAsync(v) }}
          isLoading={mutation.isPending}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
  )
}

function DeleteTransferDialog({
  transfer,
  open,
  onOpenChange,
}: {
  transfer: Transfer
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("transfers")
        .delete()
        .eq("id", transfer.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TRANSFERS_KEY })
      const previous = queryClient.getQueryData<Transfer[]>(TRANSFERS_KEY)
      queryClient.setQueryData<Transfer[]>(TRANSFERS_KEY, (old = []) =>
        old.filter((t) => t.id !== transfer.id)
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(TRANSFERS_KEY, context.previous)
      toast.error("Error al eliminar la transferencia", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia eliminada")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar transferencia</DialogTitle>
          <DialogDescription>
            ¿Estás seguro? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="press-effect"
          >
            {mutation.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit/Delete dialogs for movements ─────────────────────────────────────────

function EditMovementDialog({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  movement: Movement
  accounts: Account[]
  categories: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: MovementFormValues) => {
      const supabase = createClient()
      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency
      const { data, error } = await supabase
        .from("movements")
        .update({
          type: values.type,
          amount: values.amount,
          original_currency: values.original_currency,
          account_id: values.account_id,
          category_id: values.category_id,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", movement.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: MOVEMENTS_KEY })
      const previous = queryClient.getQueryData<Movement[]>(MOVEMENTS_KEY)
      queryClient.setQueryData<Movement[]>(MOVEMENTS_KEY, (old = []) =>
        old.map((m) =>
          m.id === movement.id
            ? {
                ...m,
                type: values.type,
                amount: values.amount,
                original_currency: values.original_currency,
                account_id: values.account_id,
                category_id: values.category_id,
                date: values.date,
                note: values.note || null,
                is_future: values.is_future,
              }
            : m
        )
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MOVEMENTS_KEY, context.previous)
      toast.error("Error al actualizar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento actualizado")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>Modificá los datos del movimiento.</DialogDescription>
        </DialogHeader>
        <MovementForm
          accounts={accounts}
          categories={categories}
          defaultValues={movementToFormValues(movement)}
          onSubmit={async (v) => { await mutation.mutateAsync(v) }}
          isLoading={mutation.isPending}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
  )
}

function DeleteMovementDialog({
  movement,
  open,
  onOpenChange,
}: {
  movement: Movement
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("movements")
        .delete()
        .eq("id", movement.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: MOVEMENTS_KEY })
      const previous = queryClient.getQueryData<Movement[]>(MOVEMENTS_KEY)
      queryClient.setQueryData<Movement[]>(MOVEMENTS_KEY, (old = []) =>
        old.filter((m) => m.id !== movement.id)
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MOVEMENTS_KEY, context.previous)
      toast.error("Error al eliminar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento eliminado")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar movimiento</DialogTitle>
          <DialogDescription>
            ¿Estás seguro? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="press-effect"
          >
            {mutation.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Type filter pills ─────────────────────────────────────────────────────────

function TypeFilterPills() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const current = searchParams.get("type") ?? "all"

  const pills = [
    { value: "all", label: "Todos" },
    { value: "expense", label: "Gastos" },
    { value: "income", label: "Ingresos" },
    { value: "transfer", label: "Transferencias" },
  ]

  const setType = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") params.delete("type")
    else params.set("type", value)
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      {pills.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setType(value)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current === value
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MovementsList() {
  const searchParams = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null)

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: MOVEMENTS_KEY,
    queryFn: fetchMovements,
  })

  const { data: transfers, isLoading: loadingTransfers } = useQuery({
    queryKey: TRANSFERS_KEY,
    queryFn: fetchTransfers,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  const isLoading = loadingMovements || loadingTransfers

  // ── Apply filters to unified feed ─────────────────────────────────────────
  const filteredFeed = useMemo<FeedItem[]>(() => {
    const typeFilter = searchParams.get("type")
    const accountFilter = searchParams.get("account")
    const categoryFilter = searchParams.get("category")
    const fromFilter = searchParams.get("from")
    const toFilter = searchParams.get("to")
    const searchFilter = searchParams.get("q")?.toLowerCase()

    const movementItems: FeedItem[] = (movements ?? [])
      .filter((m) => {
        if (typeFilter === "transfer") return false
        if (typeFilter && typeFilter !== "transfer" && m.type !== typeFilter) return false
        if (accountFilter && m.account_id !== accountFilter) return false
        if (categoryFilter && m.category_id !== categoryFilter) return false
        if (fromFilter && m.date < fromFilter) return false
        if (toFilter && m.date > toFilter) return false
        if (searchFilter && !(m.note ?? "").toLowerCase().includes(searchFilter)) return false
        return true
      })
      .map((item) => ({ kind: "movement", item }) as FeedItem)

    const transferItems: FeedItem[] = (transfers ?? [])
      .filter((t) => {
        if (typeFilter && typeFilter !== "transfer" && typeFilter !== "all") return false
        if (
          accountFilter &&
          t.from_account_id !== accountFilter &&
          t.to_account_id !== accountFilter
        ) return false
        if (categoryFilter) return false // transfers have no category
        if (fromFilter && t.date < fromFilter) return false
        if (toFilter && t.date > toFilter) return false
        if (searchFilter && !(t.note ?? "").toLowerCase().includes(searchFilter)) return false
        return true
      })
      .map((item) => ({ kind: "transfer", item }) as FeedItem)

    return [...movementItems, ...transferItems]
  }, [movements, transfers, searchParams])

  // ── Group by date ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>()
    for (const fi of filteredFeed) {
      const date = fi.kind === "movement" ? fi.item.date : fi.item.date
      const day = startOfDay(parseISO(date)).toISOString()
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(fi)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => [key, items] as [string, FeedItem[]])
  }, [filteredFeed])

  const hasActiveFilters =
    searchParams.get("type") ||
    searchParams.get("account") ||
    searchParams.get("category") ||
    searchParams.get("from") ||
    searchParams.get("to") ||
    searchParams.get("q")

  const totalItems = filteredFeed.length

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Movimientos
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-150 press-effect cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              showFilters || hasActiveFilters
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            title="Filtros"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <div className="hidden lg:block">
            <QuickAddMenu accounts={accounts} categories={categories} />
          </div>
        </div>
      </div>

      {/* Type filter pills */}
      <TypeFilterPills />

      {/* Filters panel */}
      {showFilters && (
        <FiltersPanel
          accounts={accounts}
          categories={categories}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                    <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && totalItems === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <ArrowDownCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {hasActiveFilters
                ? "Sin resultados"
                : "Registrá tu primer movimiento"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {hasActiveFilters
                ? "Intentá con otros filtros o limpiá la búsqueda."
                : "Agregá un ingreso, gasto o transferencia para empezar."}
            </p>
          </div>
        </div>
      )}

      {/* Grouped feed */}
      {!isLoading && grouped.length > 0 && (
        <div className="space-y-5">
          {grouped.map(([dayKey, dayItems]) => {
            const firstDate = dayItems[0].kind === "movement"
              ? dayItems[0].item.date
              : dayItems[0].item.date
            return (
              <div key={dayKey}>
                {/* Date header */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  {formatDayLabel(firstDate)}
                </p>
                {/* Items card */}
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                  {dayItems.map((fi) => (
                    <div
                      key={fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`}
                      className="px-4"
                    >
                      {fi.kind === "movement" ? (
                        <MovementRow
                          movement={fi.item}
                          account={accountMap.get(fi.item.account_id)}
                          category={fi.item.category_id ? categoryMap.get(fi.item.category_id) : undefined}
                          onEdit={setEditingMovement}
                          onDelete={setDeletingMovement}
                        />
                      ) : (
                        <TransferRow
                          transfer={fi.item}
                          fromAccount={accountMap.get(fi.item.from_account_id)}
                          toAccount={accountMap.get(fi.item.to_account_id)}
                          onEdit={setEditingTransfer}
                          onDelete={setDeletingTransfer}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more hint */}
      {!isLoading && totalItems >= 100 && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          Mostrando los últimos 100 registros. Usá los filtros de fecha para ver más.
        </p>
      )}

      {/* Mobile FAB */}
      {accounts.length > 0 && (
        <FABQuickAdd accounts={accounts} categories={categories} />
      )}

      {/* Edit dialogs */}
      {editingMovement && (
        <EditMovementDialog
          movement={editingMovement}
          accounts={accounts}
          categories={categories}
          open={!!editingMovement}
          onOpenChange={(v) => { if (!v) setEditingMovement(null) }}
        />
      )}
      {editingTransfer && (
        <EditTransferDialog
          transfer={editingTransfer}
          accounts={accounts}
          open={!!editingTransfer}
          onOpenChange={(v) => { if (!v) setEditingTransfer(null) }}
        />
      )}

      {/* Delete dialogs */}
      {deletingMovement && (
        <DeleteMovementDialog
          movement={deletingMovement}
          open={!!deletingMovement}
          onOpenChange={(v) => { if (!v) setDeletingMovement(null) }}
        />
      )}
      {deletingTransfer && (
        <DeleteTransferDialog
          transfer={deletingTransfer}
          open={!!deletingTransfer}
          onOpenChange={(v) => { if (!v) setDeletingTransfer(null) }}
        />
      )}
    </div>
  )
}
