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
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { bulkDelete } from "@/lib/bulk-delete"
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
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoSelect } from "@/components/ui/mango-select"
import { MovementForm, movementToFormValues, type MovementFormValues, type PendingAttachments } from "./movement-form"
import { TransferForm, transferToFormValues, type TransferFormValues } from "@/components/transfers/transfer-form"
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
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"
import { useQuickAdd } from "@/components/quick-add-provider"
import { listAttachments, uploadAttachment } from "@/lib/attachments"
import { isFutureDate } from "@/lib/date-utils"

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
  selectionMode,
  isSelected,
  onToggle,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  onEdit: (m: Movement) => void
  onDelete: (m: Movement) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
}) {
  const isIncome = movement.type === "income"
  const displayAmount = movement.converted_amount ?? movement.amount
  const displayCurrency = account?.currency ?? movement.original_currency
  const isCross = movement.converted_amount !== null
  const isCuota = movement.installment_purchase_id !== null

  return (
    <div
      onClick={selectionMode ? () => onToggle?.(movement.id) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-center gap-3 py-3 group",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(movement.id)}
        />
      ) : (
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
      )}

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

      {/* Actions — visible on hover, hidden in selection mode */}
      {!selectionMode && (
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
      )}
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
  selectionMode,
  isSelected,
  onToggle,
}: {
  transfer: Transfer
  fromAccount: Account | undefined
  toAccount: Account | undefined
  onEdit: (t: Transfer) => void
  onDelete: (t: Transfer) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
}) {
  const isCross =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  // Transfers use a "t-{id}" prefix in the selection set to avoid collisions
  const selectionId = `t-${transfer.id}`

  return (
    <div
      onClick={selectionMode ? () => onToggle?.(selectionId) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-center gap-3 py-3 group",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(selectionId)}
        />
      ) : (
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

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

      {/* Actions — hidden in selection mode */}
      {!selectionMode && (
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
      )}
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
          <MangoSelect
            value={accountValue}
            onChange={(v) => updateParam("account", v === "all" ? null : v)}
            options={[
              { value: "all", label: "Todas" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
            aria-label="Filtrar por cuenta"
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs">Categoría</Label>
          <MangoSelect
            value={categoryValue}
            onChange={(v) => updateParam("category", v === "all" ? null : v)}
            options={[
              { value: "all", label: "Todas" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            aria-label="Filtrar por categoría"
          />
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

// ── Quick-add menu (desktop header, movements page) ───────────────────────────
// Delegates to the global QuickAddProvider — no local modal state needed.

function QuickAddMenu({ accounts }: { accounts: Account[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const quickAdd = useQuickAdd()

  const openDialog = (m: "movement" | "transfer" | "installment" | "ai", type?: "income" | "expense") => {
    setMenuOpen(false)
    quickAdd.open(m, type)
  }

  if (!accounts.length) return null

  return (
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
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
            <button type="button" onClick={() => openDialog("movement", "income")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowUpCircle className="h-4 w-4 text-success flex-shrink-0" />
              <span className="font-medium">Ingreso</span>
            </button>
            <button type="button" onClick={() => openDialog("movement", "expense")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowDownCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="font-medium">Gasto</span>
            </button>
            <div className="h-px bg-border/60 mx-2" />
            <button type="button" onClick={() => openDialog("transfer")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">Transferencia</span>
            </button>
            <div className="h-px bg-border/60 mx-2" />
            <button type="button" onClick={() => openDialog("installment")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">Gasto en cuotas</span>
            </button>
            <div className="h-px bg-border/60 mx-2" />
            <button type="button" onClick={() => openDialog("ai")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">Cargar con IA</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mobile FAB (movements page only) ──────────────────────────────────────────
// Delegates to the global QuickAddProvider — no local modal state needed.

function FABQuickAdd({ accounts }: { accounts: Account[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const quickAdd = useQuickAdd()

  const openDialog = (m: "movement" | "transfer" | "installment" | "ai", type?: "income" | "expense") => {
    setMenuOpen(false)
    quickAdd.open(m, type)
  }

  if (!accounts.length) return null

  return (
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
    mutationFn: async ({
      values,
      pendingComprobante,
    }: {
      values: TransferFormValues
      pendingComprobante?: File | null
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { data, error } = await supabase
        .from("transfers")
        .update({
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          from_amount: values.from_amount,
          to_amount: values.to_amount,
          date: values.date,
          note: values.note || null,
          is_future: isFutureDate(values.date),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transfer.id)
        .select()
        .single()
      if (error) throw error

      // Upload new comprobante if provided (non-blocking on failure)
      if (pendingComprobante) {
        const result = await uploadAttachment({
          file: pendingComprobante,
          userId: user.id,
          kind: "comprobante",
          transferId: transfer.id,
        })
        if (result.error) {
          toast.warning(`Transferencia actualizada, pero no se pudo adjuntar el comprobante: ${result.error}`)
        }
      }

      return data
    },
    onMutate: async ({ values }) => {
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
                is_future: isFutureDate(values.date),
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
      queryClient.invalidateQueries({ queryKey: ["transfer_attachments", transfer.id] })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia actualizada")
      onOpenChange(false)
    },
  })

  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar transferencia"
      description="Modificá los datos de la transferencia."
    >
      <TransferForm
        accounts={accounts}
        defaultValues={transferToFormValues(transfer)}
        onSubmit={async (v, pendingComprobante) => {
          await mutation.mutateAsync({ values: v, pendingComprobante })
        }}
        isLoading={mutation.isPending}
        submitLabel="Guardar cambios"
        transferId={transfer.id}
        onAttachmentDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["transfer_attachments", transfer.id] })
        }}
      />
    </MangoSheet>
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

  // 4.4 — Load existing attachments for this movement
  const { data: existingAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["movement_attachments", movement.id],
    queryFn: async () => {
      const { data } = await listAttachments(movement.id)
      return data
    },
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async ({
      values,
      pending,
    }: {
      values: MovementFormValues
      pending: PendingAttachments
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency

      // Derive is_future from the date
      const is_future = isFutureDate(values.date)

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
          is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", movement.id)
        .select()
        .single()
      if (error) throw error

      // Upload any newly chosen files (empty slots)
      const uploads: Array<{ file: File; kind: "factura" | "recibo" | "comprobante" }> = []
      if (values.type === "expense") {
        if (pending.factura) uploads.push({ file: pending.factura, kind: "factura" })
        if (pending.recibo) uploads.push({ file: pending.recibo, kind: "recibo" })
      } else if (values.type === "income") {
        if (pending.comprobante) uploads.push({ file: pending.comprobante, kind: "comprobante" })
      }
      for (const { file, kind } of uploads) {
        const result = await uploadAttachment({ file, userId: user.id, movementId: movement.id, kind })
        if (result.error) {
          toast.warning(`Movimiento actualizado, pero no se pudo adjuntar "${file.name}": ${result.error}`)
        }
      }

      return data
    },
    onMutate: async ({ values }) => {
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
                is_future: isFutureDate(values.date),
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
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar movimiento"
      description="Modificá los datos del movimiento."
    >
      <MovementForm
        accounts={accounts}
        categories={categories}
        defaultValues={movementToFormValues(movement)}
        onSubmit={async (v, pending) => { await mutation.mutateAsync({ values: v, pending }) }}
        isLoading={mutation.isPending}
        submitLabel="Guardar cambios"
        existingAttachments={existingAttachments}
        onAttachmentDeleted={() => refetchAttachments()}
      />
    </MangoSheet>
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
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const queryClient = useQueryClient()

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

  // Feed item IDs for "select all"
  const feedItemIds = useMemo(
    () => filteredFeed.map((fi) => (fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`)),
    [filteredFeed]
  )

  async function handleBulkDelete() {
    setBulkPending(true)
    const selected = Array.from(ms.selectedIds)
    const movementIds = selected.filter((id) => !id.startsWith("t-"))
    const transferIds = selected.filter((id) => id.startsWith("t-")).map((id) => id.slice(2))

    let deletedCount = 0
    let failedCount = 0

    if (movementIds.length > 0) {
      const res = await bulkDelete("movements", movementIds)
      deletedCount += res.deleted
      failedCount += res.failed
    }
    if (transferIds.length > 0) {
      const res = await bulkDelete("transfers", transferIds)
      deletedCount += res.deleted
      failedCount += res.failed
    }

    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
    queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
    queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })

    if (failedCount === 0) {
      toast.success(`Se eliminaron ${deletedCount} elemento${deletedCount !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${deletedCount}. ${failedCount} no se pud${failedCount !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Movimientos
        </h1>
        <div className="flex items-center gap-2">
          {!isLoading && totalItems > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
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
            <QuickAddMenu accounts={accounts} />
          </div>
        </div>
      </div>

      {/* Feed content — capped at max-w-3xl for readability */}
      <div className="w-full max-w-3xl space-y-5">
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
                  {dayItems.map((fi) => {
                    const feedId = fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`
                    return (
                      <div
                        key={feedId}
                        className="px-4"
                      >
                        {fi.kind === "movement" ? (
                          <MovementRow
                            movement={fi.item}
                            account={accountMap.get(fi.item.account_id)}
                            category={fi.item.category_id ? categoryMap.get(fi.item.category_id) : undefined}
                            onEdit={setEditingMovement}
                            onDelete={setDeletingMovement}
                            selectionMode={ms.selectionMode}
                            isSelected={ms.isSelected(fi.item.id)}
                            onToggle={ms.toggle}
                          />
                        ) : (
                          <TransferRow
                            transfer={fi.item}
                            fromAccount={accountMap.get(fi.item.from_account_id)}
                            toAccount={accountMap.get(fi.item.to_account_id)}
                            onEdit={setEditingTransfer}
                            onDelete={setDeletingTransfer}
                            selectionMode={ms.selectionMode}
                            isSelected={ms.isSelected(`t-${fi.item.id}`)}
                            onToggle={ms.toggle}
                          />
                        )}
                      </div>
                    )
                  })}
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
      </div>{/* end feed max-w-3xl */}

      {/* Mobile FAB */}
      {accounts.length > 0 && (
        <FABQuickAdd accounts={accounts} />
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

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={feedItemIds.length}
          onSelectAll={() => ms.toggleAll(feedItemIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <MangoSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar elementos"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={bulkPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkPending}
              className="press-effect"
            >
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} elemento{ms.count !== 1 ? "s" : ""}? Esta acción no se puede deshacer.
        </p>
      </MangoSheet>
    </div>
  )
}
