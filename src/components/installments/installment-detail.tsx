"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  Trash2,
  CreditCard,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Circle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { MangoSheet as ConfirmSheet } from "@/components/ui/mango-sheet"
import { bulkDelete } from "@/lib/bulk-delete"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { INSTALLMENTS_KEY } from "@/lib/installments"
import { MOVEMENTS_KEY, BALANCES_KEY, ACCOUNTS_KEY } from "@/lib/movements"
import type { Tables } from "@/lib/database.types"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

type InstallmentPurchase = Tables<"installment_purchases">
type Movement = Tables<"movements">
type Account = Tables<"accounts">
type Category = Tables<"categories">

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function fetchPurchase(id: string): Promise<InstallmentPurchase> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("installment_purchases")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

async function fetchInstallmentMovements(purchaseId: string): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("installment_purchase_id", purchaseId)
    .order("installment_number")
  if (error) throw error
  return data
}

async function fetchAccount(id: string): Promise<Account> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

async function fetchCategory(id: string): Promise<Category> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

// ── Installment status ─────────────────────────────────────────────────────────

type CuotaStatus = "pagada" | "proxima" | "futura"

function getCuotaStatus(movement: Movement): CuotaStatus {
  if (!movement.is_future) return "pagada"
  const today = new Date().toISOString().split("T")[0]
  if (movement.date <= today) return "proxima"
  return "futura"
}

const STATUS_LABELS: Record<CuotaStatus, string> = {
  pagada: "Pagada",
  proxima: "Próxima",
  futura: "Futura",
}

const STATUS_COLORS: Record<CuotaStatus, string> = {
  pagada: "bg-success/10 text-success",
  proxima: "bg-accent/10 text-accent",
  futura: "bg-muted text-muted-foreground",
}

const STATUS_ICONS: Record<CuotaStatus, typeof CheckCircle2> = {
  pagada: CheckCircle2,
  proxima: Clock,
  futura: Circle,
}

// ── Delete purchase dialog ─────────────────────────────────────────────────────

function DeletePurchaseDialog({
  purchase,
  open,
  onOpenChange,
  onDeleted,
}: {
  purchase: InstallmentPurchase
  open: boolean
  onOpenChange: (v: boolean) => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("installment_purchases")
        .delete()
        .eq("id", purchase.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Compra en cuotas eliminada")
      onOpenChange(false)
      onDeleted()
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar", { description: err.message })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar compra completa</DialogTitle>
          <DialogDescription>
            Se eliminarán las {purchase.installments_count} cuotas de{" "}
            <strong>{purchase.description}</strong>. Esta acción no se puede deshacer.
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
            {mutation.isPending ? "Eliminando…" : "Eliminar todo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete single cuota dialog ─────────────────────────────────────────────────

function DeleteCuotaDialog({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({
        queryKey: ["installment_movements", movement.installment_purchase_id],
      })
      toast.success("Cuota eliminada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar la cuota", { description: err.message })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Eliminar cuota {movement.installment_number}/{movement.installment_total}
          </DialogTitle>
          <DialogDescription>
            Se eliminará únicamente esta cuota. Las demás no se verán afectadas.
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
            {mutation.isPending ? "Eliminando…" : "Eliminar cuota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Cuota row ──────────────────────────────────────────────────────────────────

function CuotaRow({
  movement,
  currency,
  onDelete,
  selectionMode,
  isSelected,
  onToggle,
}: {
  movement: Movement
  currency: "ARS" | "USD"
  onDelete: (m: Movement) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
}) {
  const status = getCuotaStatus(movement)
  const StatusIcon = STATUS_ICONS[status]
  const displayAmount = movement.converted_amount ?? movement.amount

  return (
    <div
      onClick={selectionMode ? () => onToggle?.(movement.id) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-center gap-3 py-3 group px-4",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Status icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(movement.id)}
        />
      ) : (
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", STATUS_COLORS[status].split(" ")[0])}>
          <StatusIcon className={cn("h-4 w-4", STATUS_COLORS[status].split(" ")[1])} />
        </div>
      )}

      {/* Date + cuota number */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium tabular-nums">
          {format(parseISO(movement.date), "d MMM yyyy", { locale: es })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Cuota {movement.installment_number} de {movement.installment_total}
        </p>
      </div>

      {/* Status badge */}
      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", STATUS_COLORS[status])}>
        {STATUS_LABELS[status]}
      </span>

      {/* Amount */}
      <p className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
        − {formatCurrency(displayAmount, currency)}
      </p>

      {/* Delete action — hidden in selection mode */}
      {!selectionMode && (
        <button
          type="button"
          title="Eliminar cuota"
          onClick={() => onDelete(movement)}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            "hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InstallmentDetail({ purchaseId }: { purchaseId: string }) {
  const router = useRouter()
  const [deletePurchaseOpen, setDeletePurchaseOpen] = useState(false)
  const [deletingCuota, setDeletingCuota] = useState<Movement | null>(null)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const queryClient = useQueryClient()

  const { data: purchase, isLoading: loadingPurchase } = useQuery({
    queryKey: ["installment_purchase", purchaseId],
    queryFn: () => fetchPurchase(purchaseId),
  })

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ["installment_movements", purchaseId],
    queryFn: () => fetchInstallmentMovements(purchaseId),
    enabled: !!purchase,
  })

  const { data: account } = useQuery({
    queryKey: ["account", purchase?.account_id],
    queryFn: () => fetchAccount(purchase!.account_id),
    enabled: !!purchase?.account_id,
  })

  const { data: category } = useQuery({
    queryKey: ["category", purchase?.category_id],
    queryFn: () => fetchCategory(purchase!.category_id!),
    enabled: !!purchase?.category_id,
  })

  const isLoading = loadingPurchase || loadingMovements

  // Count non-future (paid/upcoming) cuotas
  const paidCount = movements?.filter((m) => !m.is_future).length ?? 0
  const currency = (purchase?.currency as "ARS" | "USD") ?? "ARS"
  const movementIds = movements?.map((m) => m.id) ?? []

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("movements", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
    queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
    queryClient.invalidateQueries({ queryKey: ["installment_movements", purchaseId] })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} cuota${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-xl animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div className="space-y-4 max-w-xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <p className="text-muted-foreground">No se encontró la compra.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
            "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
            "transition-all duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1
          className="text-2xl font-bold tracking-tight flex-1 truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Detalle de cuotas
        </h1>
        <button
          type="button"
          onClick={() => setDeletePurchaseOpen(true)}
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            "transition-all duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Eliminar compra completa"
          title="Eliminar compra completa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Purchase summary card */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold truncate">{purchase.description}</h2>
        <p
          className="text-3xl font-bold tabular-nums text-foreground leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Total {formatCurrency(purchase.total_amount, currency)}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          Cuota {paidCount} de {purchase.installments_count}
        </p>

        <div className="flex items-center gap-4 pt-1">
          {account && (
            <div className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{account.name}</span>
            </div>
          )}
          {category && (
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{category.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cuotas list */}
      {movements && movements.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Todas las cuotas
            </p>
            {!ms.selectionMode && (
              <SelectButton onClick={ms.enter} />
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {movements.map((m) => (
              <CuotaRow
                key={m.id}
                movement={m}
                currency={currency}
                onDelete={setDeletingCuota}
                selectionMode={ms.selectionMode}
                isSelected={ms.isSelected(m.id)}
                onToggle={ms.toggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Danger zone</p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeletePurchaseOpen(true)}
          className="w-full press-effect"
        >
          Eliminar compra completa
        </Button>
        <p className="text-xs text-muted-foreground">
          Al eliminar la compra se eliminan las {purchase.installments_count} cuotas asociadas.
        </p>
      </div>

      {/* Dialogs */}
      <DeletePurchaseDialog
        purchase={purchase}
        open={deletePurchaseOpen}
        onOpenChange={setDeletePurchaseOpen}
        onDeleted={() => router.push("/app/movimientos")}
      />

      {deletingCuota && (
        <DeleteCuotaDialog
          movement={deletingCuota}
          open={!!deletingCuota}
          onOpenChange={(v) => { if (!v) setDeletingCuota(null) }}
        />
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={movementIds.length}
          onSelectAll={() => ms.toggleAll(movementIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar cuotas"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkPending}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkPending} className="press-effect">
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} cuota{ms.count !== 1 ? "s" : ""}? Esta acción no se puede deshacer.
        </p>
      </ConfirmSheet>
    </div>
  )
}
