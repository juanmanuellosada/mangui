"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Clock,
  Search,
  Sparkles,
  Bookmark,
  Plus,
  SlidersHorizontal,
  X,
  ChevronDown,
  LayoutList,
  TrendingUp,
  TrendingDown,
  Scale,
  Hash,
  Divide,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { MangoSelect } from "@/components/ui/mango-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { DateRangeFilter, defaultDateRange } from "@/components/ui/date-range-filter"
import type { DateRangeValue } from "@/components/ui/date-range-filter"
import { MovementForm, movementToFormValues, type MovementFormValues, type PendingAttachments } from "./movement-form"
import { TransferForm, transferToFormValues, type TransferFormValues } from "@/components/transfers/transfer-form"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  TRANSFERS_KEY,
  ACCOUNTS_KEY,
  BALANCES_KEY,
  CATEGORIES_KEY,
  fetchMovements,
  fetchTransfers,
  filterKey,
  type MovementsFilter,
  type MovementsFilterType,
} from "@/lib/movements"
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"
import { summaryTotals } from "@/lib/stats"
import { useQuickAdd } from "@/components/quick-add-provider"
import { listAttachments, uploadAttachment } from "@/lib/attachments"
import { isFutureDate } from "@/lib/date-utils"
import { useIsDemo } from "@/lib/use-is-demo"

type Movement = Tables<"movements">
type Transfer = Tables<"transfers">
type Category = Tables<"categories">
type SavedView = Tables<"saved_views">

type GroupBy = "none" | "day" | "month" | "category" | "account"

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "Sin agrupar" },
  { value: "day", label: "Por día" },
  { value: "month", label: "Por mes" },
  { value: "category", label: "Por categoría" },
  { value: "account", label: "Por cuenta" },
]

const FETCH_LIMIT = 200

// Discriminated union for unified feed
type FeedItem =
  | { kind: "movement"; item: Movement }
  | { kind: "transfer"; item: Transfer }

// ── Default filter ────────────────────────────────────────────────────────────

function defaultFilter(): MovementsFilter {
  return {
    search: "",
    type: "all",
    date: defaultDateRange(),
    accountIds: [],
    categoryIds: [],
  }
}

// ── Saved views DB helpers ────────────────────────────────────────────────────

const SAVED_VIEWS_KEY = ["saved_views", "movements"] as const

async function fetchMovementsSavedViews(): Promise<SavedView[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .eq("scope", "movements")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

async function createMovementsSavedView(name: string, filters: MovementsFilter): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase
    .from("saved_views")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ name, filters: filters as any, user_id: user.id, scope: "movements" })
  if (error) throw error
}

async function deleteMovementsSavedView(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("saved_views").delete().eq("id", id)
  if (error) throw error
}

// ── Accounts / categories data fetchers ──────────────────────────────────────

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
  isDemo,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  onEdit: (m: Movement) => void
  onDelete: (m: Movement) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  isDemo?: boolean
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
              href={`/cuotas/${movement.installment_purchase_id}`}
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
            title={isDemo ? "No disponible en el modo demo" : "Editar"}
            className="press-effect cursor-pointer"
            onClick={() => onEdit(movement)}
            disabled={isDemo}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Eliminar"}
            className="press-effect cursor-pointer"
            onClick={() => onDelete(movement)}
            disabled={isDemo}
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
  isDemo,
}: {
  transfer: Transfer
  fromAccount: Account | undefined
  toAccount: Account | undefined
  onEdit: (t: Transfer) => void
  onDelete: (t: Transfer) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  isDemo?: boolean
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
            title={isDemo ? "No disponible en el modo demo" : "Editar"}
            className="press-effect cursor-pointer"
            onClick={() => onEdit(transfer)}
            disabled={isDemo}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Eliminar"}
            className="press-effect cursor-pointer"
            onClick={() => onDelete(transfer)}
            disabled={isDemo}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Quick-add menu (desktop header, movements page) ───────────────────────────

function QuickAddMenu({ accounts }: { accounts: Account[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const quickAdd = useQuickAdd()
  const router = useRouter()

  const openDialog = (m: "movement" | "transfer", type?: "income" | "expense") => {
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
            <button type="button" onClick={() => { setMenuOpen(false); router.push("/ia") }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">Cargar con IA</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mobile FAB ────────────────────────────────────────────────────────────────

function FABQuickAdd({ accounts }: { accounts: Account[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const quickAdd = useQuickAdd()
  const router = useRouter()

  const openDialog = (m: "movement" | "transfer", type?: "income" | "expense") => {
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
                { m: "movement" as const, type: "income" as const, icon: ArrowUpCircle, label: "Ingreso", color: "bg-success text-white", isAI: false },
                { m: "movement" as const, type: "expense" as const, icon: ArrowDownCircle, label: "Gasto", color: "bg-destructive text-white", isAI: false },
                { m: "transfer" as const, type: undefined, icon: ArrowLeftRight, label: "Transferencia", color: "bg-muted-foreground text-white", isAI: false },
                { m: "movement" as const, type: undefined, icon: Sparkles, label: "Cargar con IA", color: "bg-primary/80 text-primary-foreground", isAI: true },
              ] as const
            ).map(({ m, type, icon: Icon, label, color, isAI }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  if (isAI) {
                    router.push("/ia")
                  } else {
                    openDialog(m, type as "income" | "expense" | undefined)
                  }
                }}
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
      const previousAll = queryClient.getQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY })
      queryClient.setQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY }, (old = []) =>
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
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
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
      const previousAll = queryClient.getQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY })
      queryClient.setQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY }, (old = []) =>
        old.filter((t) => t.id !== transfer.id)
      )
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
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
      <DialogContent compact className="max-w-sm">
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

export function EditMovementDialog({
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
      const previousAll = queryClient.getQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY })
      queryClient.setQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY }, (old = []) =>
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
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
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
      const previousAll = queryClient.getQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY })
      queryClient.setQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY }, (old = []) =>
        old.filter((m) => m.id !== movement.id)
      )
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
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
      <DialogContent compact className="max-w-sm">
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

// ── Movements filter bar ──────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: MovementsFilterType; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer", label: "Transferencias" },
]

interface MovementsFilterBarProps {
  filter: MovementsFilter
  onChange: (f: MovementsFilter) => void
  accounts: Account[]
  categories: Category[]
  groupBy: GroupBy
  onGroupByChange: (g: GroupBy) => void
  isDemo?: boolean
}

function MovementsFilterBar({ filter, onChange, accounts, categories, groupBy, onGroupByChange, isDemo }: MovementsFilterBarProps) {
  const queryClient = useQueryClient()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  // Mobile: expanded state for the secondary filters panel
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: savedViews = [] } = useQuery({
    queryKey: SAVED_VIEWS_KEY,
    queryFn: fetchMovementsSavedViews,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, f }: { name: string; f: MovementsFilter }) =>
      createMovementsSavedView(name, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_VIEWS_KEY })
      toast.success("Vista guardada")
      setSaveDialogOpen(false)
      setSaveName("")
    },
    onError: () => toast.error("No se pudo guardar la vista"),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMovementsSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_VIEWS_KEY })
      toast.success("Vista eliminada")
    },
    onError: () => toast.error("No se pudo eliminar"),
  })

  function loadView(view: SavedView) {
    const f = view.filters as unknown as MovementsFilter
    onChange(f)
  }

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    leading: <AccountIconChip icon={a.icon} />,
  }))

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
    leading: <CategoryIconChip icon={c.icon} />,
  }))

  // Active filter chips for mobile compact row
  const activeChips: string[] = []
  if (filter.type !== "all") {
    activeChips.push(TYPE_OPTIONS.find((t) => t.value === filter.type)?.label ?? "")
  }
  if (filter.date.preset !== "all_time") {
    activeChips.push(filter.date.label)
  }
  if (filter.accountIds.length > 0) {
    activeChips.push(`${filter.accountIds.length} cuenta${filter.accountIds.length !== 1 ? "s" : ""}`)
  }
  if (filter.categoryIds.length > 0) {
    activeChips.push(`${filter.categoryIds.length} categoría${filter.categoryIds.length !== 1 ? "s" : ""}`)
  }

  const hasActiveFilters =
    filter.type !== "all" ||
    filter.date.preset !== "all_time" ||
    filter.date.from !== null ||
    filter.date.to !== null ||
    filter.accountIds.length > 0 ||
    filter.categoryIds.length > 0 ||
    filter.search !== ""

  function clearAll() {
    onChange(defaultFilter())
  }

  // ── Secondary filters (shared between desktop always-visible and mobile expanded) ──
  const secondaryFilters = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Type pills */}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...filter, type: value })}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 press-effect cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter.type === value
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Fecha · Agrupar · Cuentas · Categorías — single row */}
      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <Label className="text-xs">Fecha</Label>
          <DateRangeFilter
            value={filter.date}
            onChange={(date: DateRangeValue) => onChange({ ...filter, date })}
          />
        </div>
        <div className="space-y-1.5 w-44 shrink-0">
          <Label className="text-xs flex items-center gap-1">
            <LayoutList className="h-3 w-3" aria-hidden />
            Agrupar
          </Label>
          <MangoSelect
            value={groupBy}
            onChange={(v) => onGroupByChange(v as GroupBy)}
            options={GROUP_BY_OPTIONS}
            aria-label="Agrupar movimientos"
          />
        </div>
        <div className="space-y-1.5 w-44 shrink-0">
          <Label className="text-xs">Cuentas</Label>
          <MangoMultiSelect
            values={filter.accountIds}
            onChange={(accountIds) => onChange({ ...filter, accountIds })}
            options={accountOptions}
            placeholder="Todas las cuentas"
            showSearch
            aria-label="Filtrar por cuenta"
          />
        </div>
        <div className="space-y-1.5 w-44 shrink-0">
          <Label className="text-xs">Categorías</Label>
          <MangoMultiSelect
            values={filter.categoryIds}
            onChange={(categoryIds) => onChange({ ...filter, categoryIds })}
            options={categoryOptions}
            placeholder={filter.type === "transfer" ? "No aplica" : "Todas las categorías"}
            showSearch
            disabled={filter.type === "transfer"}
            aria-label="Filtrar por categoría"
          />
        </div>
      </div>

    </div>
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      {/* Top row: search + actions */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar por nota, categoría o cuenta…"
            value={filter.search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg text-sm",
              "bg-background border border-input",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "transition-colors duration-150"
            )}
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filter, search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile: "Filtros" button */}
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className={cn(
            "lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium",
            "border transition-colors duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mobileExpanded || hasActiveFilters
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-input bg-background text-muted-foreground hover:text-foreground"
          )}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeChips.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeChips.length}
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", mobileExpanded && "rotate-180")} />
        </button>

        {/* Saved views */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background">
            <Bookmark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Vistas</span>
            {savedViews.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                {savedViews.length}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {savedViews.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin vistas guardadas</div>
            )}
            {savedViews.map((view) => (
              <div key={view.id} className="flex items-center gap-1 px-1">
                <DropdownMenuItem
                  className="flex-1"
                  onSelect={() => loadView(view)}
                >
                  <span className="truncate">{view.name}</span>
                </DropdownMenuItem>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDemo) deleteMutation.mutate(view.id)
                  }}
                  disabled={isDemo}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                  aria-label={`Eliminar vista ${view.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => !isDemo && setSaveDialogOpen(true)} disabled={isDemo} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Guardar filtros actuales
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            aria-label="Limpiar filtros"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Mobile active chips */}
      {!mobileExpanded && activeChips.length > 0 && (
        <div className="lg:hidden flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {chip}
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-destructive text-xs transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        </div>
      )}

      {/* Desktop: always show secondary filters */}
      <div className="hidden lg:block">
        {secondaryFilters}
      </div>

      {/* Mobile: show secondary filters when expanded */}
      {mobileExpanded && (
        <div className="lg:hidden">
          {secondaryFilters}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}

      {/* Save view dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent compact className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="view-name-movements">Nombre de la vista</Label>
              <Input
                id="view-name-movements"
                placeholder="Gastos de enero…"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveName.trim()) {
                    createMutation.mutate({ name: saveName.trim(), f: filter })
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!saveName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: saveName.trim(), f: filter })}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MovementsList() {
  const isDemo = useIsDemo()
  const [filter, setFilter] = useState<MovementsFilter>(defaultFilter)
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const queryClient = useQueryClient()

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  // Derive the stable filter key once so both queries share it
  const fKey = filterKey(filter)

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: [...MOVEMENTS_KEY, fKey],
    queryFn: () => fetchMovements(filter, accounts, categories),
    enabled: accounts.length > 0, // wait for lookups to be loaded
  })

  const { data: transfers, isLoading: loadingTransfers } = useQuery({
    queryKey: [...TRANSFERS_KEY, fKey],
    queryFn: () => fetchTransfers(filter, accounts),
    enabled: accounts.length > 0,
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

  // ── Build unified feed ─────────────────────────────────────────────────────
  const feed = useMemo<FeedItem[]>(() => {
    const movementItems: FeedItem[] = (movements ?? []).map((item) => ({ kind: "movement", item }) as FeedItem)
    const transferItems: FeedItem[] = (transfers ?? []).map((item) => ({ kind: "transfer", item }) as FeedItem)
    return [...movementItems, ...transferItems]
  }, [movements, transfers])

  // ── Totals for summary cards ───────────────────────────────────────────────
  const totals = useMemo(
    () => summaryTotals(movements ?? [], "ARS"),
    [movements]
  )

  const incomeCount = useMemo(
    () => (movements ?? []).filter((m) => m.type === "income").length,
    [movements]
  )
  const expenseCount = useMemo(
    () => (movements ?? []).filter((m) => m.type === "expense").length,
    [movements]
  )
  const avgIncome = incomeCount ? totals.income / incomeCount : 0
  const avgExpense = expenseCount ? totals.expense / expenseCount : 0
  const transferCount = transfers?.length ?? 0
  const transferTotal = useMemo(
    () => (transfers ?? []).reduce((acc, t) => acc + t.from_amount, 0),
    [transfers]
  )

  // ── Build grouped feed parametrized by groupBy ───────────────────────────
  const groupedFeed = useMemo<{ key: string; label: string; items: FeedItem[] }[]>(() => {
    if (groupBy === "none") {
      // Flat list — still sorted desc; return a single pseudo-group with no label
      const sorted = [...feed].sort((a, b) => {
        const dateDiff = b.item.date.localeCompare(a.item.date)
        if (dateDiff !== 0) return dateDiff
        return b.item.created_at.localeCompare(a.item.created_at)
      })
      return sorted.length > 0 ? [{ key: "__flat__", label: "", items: sorted }] : []
    }

    if (groupBy === "day") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        const day = startOfDay(parseISO(fi.item.date)).toISOString()
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, items]) => ({
          key,
          label: formatDayLabel(items[0].item.date),
          items,
        }))
    }

    if (groupBy === "month") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        const d = parseISO(fi.item.date)
        const monthKey = format(d, "yyyy-MM")
        if (!map.has(monthKey)) map.set(monthKey, [])
        map.get(monthKey)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, items]) => {
          const d = parseISO(key + "-01")
          const label = format(d, "MMMM yyyy", { locale: es })
          return { key, label: label.charAt(0).toUpperCase() + label.slice(1), items }
        })
    }

    if (groupBy === "category") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        let key: string
        if (fi.kind === "transfer") {
          key = "__transfer__"
        } else {
          key = fi.item.category_id ?? "__none__"
        }
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, items]) => {
          let label: string
          if (key === "__transfer__") label = "Transferencias"
          else if (key === "__none__") label = "Sin categoría"
          else label = categoryMap.get(key)?.name ?? "Sin categoría"
          return { key, label, items }
        })
    }

    if (groupBy === "account") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        let key: string
        if (fi.kind === "transfer") {
          key = "__transfer__"
        } else {
          key = fi.item.account_id
        }
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, items]) => {
          let label: string
          if (key === "__transfer__") label = "Transferencias"
          else label = accountMap.get(key)?.name ?? "—"
          return { key, label, items }
        })
    }

    return []
  }, [feed, groupBy, accountMap, categoryMap])

  const totalItems = feed.length

  const hasActiveFilters =
    filter.type !== "all" ||
    filter.date.preset !== "all_time" ||
    filter.date.from !== null ||
    filter.date.to !== null ||
    filter.accountIds.length > 0 ||
    filter.categoryIds.length > 0 ||
    filter.search !== ""

  // Feed item IDs for "select all"
  const feedItemIds = useMemo(
    () => feed.map((fi) => (fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`)),
    [feed]
  )

  // Whether results are at the limit (suggesting truncation)
  const movementsAtLimit = (movements?.length ?? 0) >= FETCH_LIMIT
  const transfersAtLimit = (transfers?.length ?? 0) >= FETCH_LIMIT

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
          <div className="hidden lg:block">
            <QuickAddMenu accounts={accounts} />
          </div>
        </div>
      </div>

      {/* Filter bar — always visible */}
      <MovementsFilterBar
        filter={filter}
        onChange={setFilter}
        accounts={accounts}
        categories={categories}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        isDemo={isDemo}
      />

      {/* Adaptive summary cards */}
      {!isLoading && totalItems > 0 && (
        <div className="space-y-2">
          {filter.type === "all" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-success flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Ingresos</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-success leading-tight">
                  +{formatCurrency(totals.income, "ARS")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Gastos</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-destructive leading-tight">
                  −{formatCurrency(totals.expense, "ARS")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Balance</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className={`text-base font-bold tabular-nums leading-tight ${totals.net >= 0 ? "text-success" : "text-destructive"}`}>
                  {totals.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(totals.net), "ARS")}
                </p>
              </div>
            </div>
          )}

          {filter.type === "income" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-success flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Total ingresos</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-success leading-tight">
                  +{formatCurrency(totals.income, "ARS")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Cantidad</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {incomeCount}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Divide className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Promedio</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {formatCurrency(avgIncome, "ARS")}
                </p>
              </div>
            </div>
          )}

          {filter.type === "expense" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Total gastos</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-destructive leading-tight">
                  −{formatCurrency(totals.expense, "ARS")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Cantidad</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {expenseCount}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Divide className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Promedio</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {formatCurrency(avgExpense, "ARS")}
                </p>
              </div>
            </div>
          )}

          {filter.type === "transfer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Transferencias</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {transferCount}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <p className="text-xs font-medium text-muted-foreground truncate">Total movido</p>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-none">{filter.date.label}</p>
                <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {formatCurrency(transferTotal, "ARS")}
                </p>
              </div>
            </div>
          )}

          {filter.type !== "transfer" && (
            <p className="text-xs text-muted-foreground px-1">
              {totalItems} {totalItems === 1 ? "movimiento" : "movimientos"}
            </p>
          )}
        </div>
      )}
      {isLoading && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
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

      {/* Feed (flat or grouped) */}
      {!isLoading && groupedFeed.length > 0 && (
        <div className="space-y-5">
          {groupedFeed.map(({ key, label, items }) => (
            <div key={key}>
              {/* Group header — hidden in flat mode */}
              {groupBy !== "none" && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  {label}
                </p>
              )}
              {/* Items card */}
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                {items.map((fi) => {
                  const feedId = fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`
                  return (
                    <div key={feedId} className="px-4">
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
                          isDemo={isDemo}
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
                          isDemo={isDemo}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more / truncation notice */}
      {!isLoading && (movementsAtLimit || transfersAtLimit) && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          Mostrando los primeros {FETCH_LIMIT} registros. Usá los filtros de fecha para ver períodos anteriores.
        </p>
      )}

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
              disabled={bulkPending || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
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
