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
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { MangoSheet } from "@/components/ui/mango-sheet"
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
import { INSTALLMENTS_KEY, computeInstallmentAmounts } from "@/lib/installments"
import { MOVEMENTS_KEY, BALANCES_KEY, ACCOUNTS_KEY, DOLLAR_TYPE_LABELS, type DollarType } from "@/lib/movements"
import { isInCycle, listCardCycles, type CardCycle } from "@/lib/cards"
import { isFutureDate } from "@/lib/date-utils"
import { addMonths, parseISO } from "date-fns"
import type { Tables } from "@/lib/database.types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { useIsDemo } from "@/lib/use-is-demo"

type InstallmentPurchase = Tables<"installment_purchases">
type Movement = Tables<"movements">
type Account = Tables<"accounts">
type Category = Tables<"categories">
type CardStatement = Tables<"card_statements">

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

async function fetchAllMovementsForAccount(accountId: string): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("account_id", accountId)
    .eq("type", "expense")
  if (error) throw error
  return data
}

async function fetchStatementsForAccount(accountId: string): Promise<CardStatement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("card_statements")
    .select("*")
    .eq("account_id", accountId)
  if (error) throw error
  return data
}

async function fetchAllCreditCardAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("type", "tarjeta_credito")
    .order("name")
  if (error) throw error
  return data
}

async function fetchAllCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
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

// ── Helpers: paid-cycle detection ──────────────────────────────────────────────

/**
 * Given a date string and the list of cycles for the card, returns whether that date
 * falls in a cycle whose statement has status "pagado".
 */
function isDateInPaidCycle(
  dateStr: string,
  cycles: CardCycle[]
): boolean {
  for (const cycle of cycles) {
    if (
      cycle.statement?.status === "pagado" &&
      isInCycle(dateStr, cycle.cycleStart, cycle.cycleEnd)
    ) {
      return true
    }
  }
  return false
}

// ── Delete purchase dialog ─────────────────────────────────────────────────────

function DeletePurchaseDialog({
  purchase,
  open,
  onOpenChange,
  onDeleted,
  isDemo,
}: {
  purchase: InstallmentPurchase
  open: boolean
  onOpenChange: (v: boolean) => void
  onDeleted: () => void
  isDemo?: boolean
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
      <DialogContent compact className="max-w-sm">
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
            disabled={mutation.isPending || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
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
  isDemo,
}: {
  movement: Movement
  open: boolean
  onOpenChange: (v: boolean) => void
  isDemo?: boolean
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
      <DialogContent compact className="max-w-sm">
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
            disabled={mutation.isPending || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            className="press-effect"
          >
            {mutation.isPending ? "Eliminando…" : "Eliminar cuota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Cuota row (detail list) ────────────────────────────────────────────────────

function CuotaRow({
  movement,
  currency,
  onDelete,
  selectionMode,
  isSelected,
  onToggle,
  postponeControls,
  isDemo,
}: {
  movement: Movement
  currency: "ARS" | "USD"
  onDelete: (m: Movement) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  postponeControls?: React.ReactNode
  isDemo?: boolean
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

      {/* Postpone controls */}
      {!selectionMode && postponeControls}

      {/* Status badge */}
      {!postponeControls && (
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", STATUS_COLORS[status])}>
          {STATUS_LABELS[status]}
        </span>
      )}

      {/* Amount */}
      <p className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
        − {formatCurrency(displayAmount, currency)}
      </p>

      {/* Delete action — hidden in selection mode or when postpone controls shown */}
      {!selectionMode && !postponeControls && (
        <button
          type="button"
          title={isDemo ? "No disponible en el modo demo" : "Eliminar cuota"}
          onClick={isDemo ? undefined : () => onDelete(movement)}
          disabled={isDemo}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            "hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── PostponeControls ───────────────────────────────────────────────────────────

function PostponeControls({
  movement,
  allMovements,
  cycles,
  purchaseId,
  startDate,
  isDemo,
}: {
  movement: Movement
  allMovements: Movement[]
  cycles: CardCycle[]
  purchaseId: string
  startDate: string
  isDemo?: boolean
}) {
  const queryClient = useQueryClient()
  const [pendingDelta, setPendingDelta] = useState<-1 | 1 | null>(null)

  // Movements from installment_number >= this one (cascade targets)
  const affectedMovements = allMovements.filter(
    (m) => (m.installment_number ?? 0) >= (movement.installment_number ?? 0)
  )

  function wouldLandInPaid(deltaMonths: number): boolean {
    for (const m of affectedMovements) {
      const newDate = addMonths(parseISO(m.date), deltaMonths)
        .toISOString()
        .split("T")[0]
      if (isDateInPaidCycle(newDate, cycles)) return true
    }
    return false
  }

  const canMinus = !wouldLandInPaid(-1)
  const canPlus = !wouldLandInPaid(1)

  const postponeMutation = useMutation({
    mutationFn: async (deltaMonths: number) => {
      const supabase = createClient()
      // Shift each affected movement
      for (const m of affectedMovements) {
        const newDate = addMonths(parseISO(m.date), deltaMonths)
          .toISOString()
          .split("T")[0]
        const newIsFuture = isFutureDate(newDate)
        const { error } = await supabase
          .from("movements")
          .update({ date: newDate, is_future: newIsFuture, updated_at: new Date().toISOString() })
          .eq("id", m.id)
        if (error) throw error
      }

      // If installment 1 is among the shifted ones, update installment_purchases.start_date
      const firstCuota = allMovements.find((m) => m.installment_number === 1)
      if (firstCuota && affectedMovements.some((m) => m.id === firstCuota.id)) {
        const newStart = addMonths(parseISO(startDate), deltaMonths)
          .toISOString()
          .split("T")[0]
        const { error } = await supabase
          .from("installment_purchases")
          .update({ start_date: newStart })
          .eq("id", purchaseId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ["installment_movements", purchaseId] })
      // Also invalidate card movements so statements recompute
      queryClient.invalidateQueries({ queryKey: ["movements", "card"] })
      toast.success("Cuotas actualizadas")
    },
    onError: (err: Error) => {
      toast.error("Error al postergar", { description: err.message })
    },
  })

  const isPending = postponeMutation.isPending
  const count = affectedMovements.length
  const directionLabel = pendingDelta === 1 ? "adelante" : "atrás"

  function handleConfirm() {
    if (pendingDelta !== null) {
      postponeMutation.mutate(pendingDelta)
      setPendingDelta(null)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          disabled={!canMinus || isPending || isDemo}
          onClick={() => setPendingDelta(-1)}
          title={isDemo ? "No disponible en el modo demo" : "−1 mes"}
          aria-label="Mover cuota un mes atrás"
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            "transition-colors duration-150 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={!canPlus || isPending || isDemo}
          onClick={() => setPendingDelta(1)}
          title={isDemo ? "No disponible en el modo demo" : "+1 mes"}
          aria-label="Mover cuota un mes adelante"
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            "transition-colors duration-150 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={pendingDelta !== null} onOpenChange={(v) => { if (!v) setPendingDelta(null) }}>
        <DialogContent compact className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover cuotas</DialogTitle>
            <DialogDescription>
              Se moverán {count} cuota{count !== 1 ? "s" : ""} un mes hacia {directionLabel}. ¿Confirmás?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelta(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className="press-effect"
            >
              {isPending ? "Moviendo…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── EditPurchaseSheet ──────────────────────────────────────────────────────────

interface EditPurchaseSheetProps {
  purchase: InstallmentPurchase
  movements: Movement[]
  cycles: CardCycle[]
  /** Pre-loaded credit-card accounts. When absent, fetched internally. */
  availableAccounts?: Account[]
  /** Pre-loaded categories. When absent, fetched internally. */
  availableCategories?: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
  isDemo?: boolean
}

function EditPurchaseSheet({
  purchase,
  movements,
  cycles,
  availableAccounts,
  availableCategories,
  open,
  onOpenChange,
  isDemo,
}: EditPurchaseSheetProps) {
  const queryClient = useQueryClient()

  // Form state — prefill from purchase
  const [description, setDescription] = useState(purchase.description)
  const [categoryId, setCategoryId] = useState<string | null>(purchase.category_id)
  const [totalAmount, setTotalAmount] = useState(purchase.total_amount)
  const [accountId, setAccountId] = useState(purchase.account_id)
  const [dollarType, setDollarType] = useState<DollarType | null>(
    (purchase.dollar_type as DollarType | null) ?? null
  )
  const [convertedTotal, setConvertedTotal] = useState<number | null>(null)

  // Internal fetches — only when parent didn't provide
  const { data: fetchedAccounts = [] } = useQuery({
    queryKey: ["credit_card_accounts_for_edit"],
    queryFn: fetchAllCreditCardAccounts,
    enabled: !availableAccounts,
    staleTime: 60_000,
  })
  const { data: fetchedCategories = [] } = useQuery({
    queryKey: ["categories_for_edit"],
    queryFn: fetchAllCategories,
    enabled: !availableCategories,
    staleTime: 60_000,
  })

  const creditCardAccounts = availableAccounts
    ? availableAccounts.filter((a) => a.type === "tarjeta_credito")
    : fetchedAccounts
  const allCategories = availableCategories ?? fetchedCategories
  const expenseCategories = allCategories.filter((c) => c.type === "expense")

  // Determine cross-currency: purchase.currency is the expense currency; the selected account's currency is the account currency
  const selectedAccount = creditCardAccounts.find((a) => a.id === accountId)
  const accountCurrency = selectedAccount?.currency ?? "ARS"
  const purchaseCurrency = purchase.currency as "ARS" | "USD"
  const isCrossCurrency = purchaseCurrency !== accountCurrency

  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()

      // 1. Update installment_purchases row
      const { error: purchaseErr } = await supabase
        .from("installment_purchases")
        .update({
          description,
          category_id: categoryId,
          total_amount: totalAmount,
          account_id: accountId,
          dollar_type: isCrossCurrency ? dollarType : null,
          currency: purchaseCurrency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchase.id)
      if (purchaseErr) throw purchaseErr

      // 2. Determine paid vs unpaid cuotas
      const paidMovements = movements.filter((m) => isDateInPaidCycle(m.date, cycles))
      const unpaidMovements = movements
        .filter((m) => !isDateInPaidCycle(m.date, cycles))
        .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))

      if (unpaidMovements.length === 0) {
        // No unpaid cuotas — nothing to recompute (guard against divide-by-zero)
        return
      }

      // 3. Compute remaining = new total − sum of paid cuota amounts
      const paidSum = paidMovements.reduce((acc, m) => acc + m.amount, 0)
      const remaining = Math.round((totalAmount - paidSum) * 100) / 100

      // Distribute remaining across unpaid cuotas (last one absorbs rounding)
      const unpaidCount = unpaidMovements.length
      const { perAmount, lastAmount } = computeInstallmentAmounts(remaining, unpaidCount)

      // Compute converted_total pro-rata (for cross-currency)
      // If user provided convertedTotal use it; otherwise null
      let perConverted: number | null = null
      let lastConverted: number | null = null
      if (isCrossCurrency && convertedTotal !== null && convertedTotal > 0) {
        const paidConvertedSum = paidMovements.reduce(
          (acc, m) => acc + (m.converted_amount ?? 0),
          0
        )
        const remainingConverted = Math.round((convertedTotal - paidConvertedSum) * 100) / 100
        const { perAmount: perC, lastAmount: lastC } = computeInstallmentAmounts(
          remainingConverted,
          unpaidCount
        )
        perConverted = perC
        lastConverted = lastC
      }

      // 4. Update each unpaid movement
      for (let i = 0; i < unpaidMovements.length; i++) {
        const m = unpaidMovements[i]
        const isLast = i === unpaidMovements.length - 1
        const newAmount = isLast ? lastAmount : perAmount
        const newConverted = isCrossCurrency
          ? isLast
            ? lastConverted
            : perConverted
          : null

        const { error: mvErr } = await supabase
          .from("movements")
          .update({
            amount: newAmount,
            category_id: categoryId,
            account_id: accountId,
            dollar_type: isCrossCurrency ? dollarType : null,
            converted_amount: newConverted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", m.id)
        if (mvErr) throw mvErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: ["installment_purchase", purchase.id] })
      queryClient.invalidateQueries({ queryKey: ["installment_movements", purchase.id] })
      queryClient.invalidateQueries({ queryKey: ["movements", "card"] })
      toast.success("Compra actualizada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al guardar", { description: err.message })
    },
  })

  function handleSave() {
    if (!description.trim()) {
      toast.error("La descripción no puede estar vacía")
      return
    }
    if (totalAmount <= 0) {
      toast.error("El monto debe ser mayor a 0")
      return
    }
    saveMutation.mutate()
  }

  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar compra"
      footer={
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            className="press-effect"
          >
            {saveMutation.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Descripción */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Descripción</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: notebook, heladera…"
            maxLength={200}
          />
        </div>

        {/* Monto total */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Monto total</Label>
          <MoneyInput
            step="0.01"
            min="0.01"
            placeholder="0"
            currency={purchaseCurrency}
            className="text-2xl font-bold tabular-nums h-14 rounded-xl border-border/60"
            wrapperClassName="w-full"
            value={totalAmount || ""}
            onChange={(e) =>
              setTotalAmount(e.target.value ? parseFloat(e.target.value) : 0)
            }
          />
        </div>

        {/* Cuenta (solo tarjetas de crédito) */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Cuenta / tarjeta</Label>
          <MangoSelect
            value={accountId}
            onChange={(v) => v && setAccountId(v)}
            options={creditCardAccounts.map((a) => ({
              value: a.id,
              label: a.name,
              leading: <AccountIconChip icon={a.icon} />,
            }))}
            placeholder="Tarjeta"
            showSearch
          />
        </div>

        {/* Categoría */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Categoría</Label>
          <MangoSelect
            value={categoryId ?? "none"}
            onChange={(v) => setCategoryId(v === "none" ? null : v)}
            options={[
              { value: "none", label: "Sin categoría" },
              ...expenseCategories.map((c) => ({
                value: c.id,
                label: c.name,
                leading: c.icon ? (
                  <CategoryIconChip icon={c.icon} />
                ) : undefined,
              })),
            ]}
            placeholder="Categoría"
            showSearch
          />
        </div>

        {/* Tipo de dólar — solo cuando cross-currency */}
        {isCrossCurrency && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              La cuenta está en <strong className="text-foreground">{accountCurrency}</strong> pero
              la compra es en <strong className="text-foreground">{purchaseCurrency}</strong> —
              seleccioná el tipo de cambio:
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Tipo de dólar</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(DOLLAR_TYPE_LABELS) as [DollarType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDollarType(key)}
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
              <Label className="text-xs text-muted-foreground font-medium">
                Monto total en {accountCurrency} (opcional)
              </Label>
              <MoneyInput
                step="0.01"
                placeholder="0,00"
                currency={accountCurrency as "ARS" | "USD"}
                className="tabular-nums w-full"
                value={convertedTotal ?? ""}
                onChange={(e) =>
                  setConvertedTotal(e.target.value ? parseFloat(e.target.value) : null)
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Si lo dejás vacío, converted_amount de las cuotas no pagadas quedará en null.
              </p>
            </div>
          </div>
        )}

        {/* Info about what will be recalculated */}
        {(() => {
          const paidCount = movements.filter((m) => isDateInPaidCycle(m.date, cycles)).length
          const unpaidCount = movements.length - paidCount
          if (unpaidCount === 0) {
            return (
              <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 px-3 py-2">
                Todas las cuotas ya están pagadas — solo se actualizarán los datos de la compra.
              </p>
            )
          }
          return (
            <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 px-3 py-2">
              Se recalcularán {unpaidCount} cuota{unpaidCount !== 1 ? "s" : ""} no pagada
              {unpaidCount !== 1 ? "s" : ""}
              {paidCount > 0 ? ` (${paidCount} pagada${paidCount !== 1 ? "s" : ""} no se tocarán)` : ""}.
            </p>
          )
        })()}
      </div>
    </MangoSheet>
  )
}

// ── InstallmentDetailBody ──────────────────────────────────────────────────────
// Shared body used both in the full-page route and in the modal from cards-list.

export interface InstallmentDetailBodyProps {
  purchaseId: string
  /**
   * When provided, enables postpone controls.
   * Pass the card account so we can compute listCardCycles to evaluate paid cycles.
   */
  cardAccount?: Account
  cardStatements?: CardStatement[]
  /**
   * All accounts (used in the "Editar compra" form for account selection).
   * When absent, accounts are fetched internally (credit cards only).
   */
  accounts?: Account[]
  /**
   * All categories (used in the "Editar compra" form).
   * When absent, categories are fetched internally.
   */
  categories?: Category[]
}

export function InstallmentDetailBody({
  purchaseId,
  cardAccount,
  cardStatements,
  accounts,
  categories,
}: InstallmentDetailBodyProps) {
  const isDemo = useIsDemo()
  const [deletePurchaseOpen, setDeletePurchaseOpen] = useState(false)
  const [deletingCuota, setDeletingCuota] = useState<Movement | null>(null)
  const [editPurchaseOpen, setEditPurchaseOpen] = useState(false)
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

  // When cardAccount is not provided, fetch account from purchase
  const { data: fetchedAccount } = useQuery({
    queryKey: ["account", purchase?.account_id],
    queryFn: () => fetchAccount(purchase!.account_id),
    enabled: !!purchase?.account_id && !cardAccount,
  })

  const account = cardAccount ?? fetchedAccount

  const { data: category } = useQuery({
    queryKey: ["category", purchase?.category_id],
    queryFn: () => fetchCategory(purchase!.category_id!),
    enabled: !!purchase?.category_id,
  })

  // Fetch all card movements (needed for cycle computation) only when postpone controls are needed
  const { data: allCardMovements = [] } = useQuery({
    queryKey: ["movements", "card", cardAccount?.id],
    queryFn: () => fetchAllMovementsForAccount(cardAccount!.id),
    enabled: !!cardAccount,
  })

  // Fetch statements for card if not passed in
  const { data: fetchedStatements = [] } = useQuery({
    queryKey: ["card_statements", cardAccount?.id],
    queryFn: () => fetchStatementsForAccount(cardAccount!.id),
    enabled: !!cardAccount && !cardStatements,
  })

  const statements: CardStatement[] = cardStatements ?? fetchedStatements

  // Build cycles for paid-cycle detection
  const cycles: CardCycle[] = cardAccount
    ? listCardCycles(cardAccount.id, cardAccount, allCardMovements, statements)
    : []

  const isLoading = loadingPurchase || loadingMovements

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
      <div className="space-y-5 animate-fade-in">
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
      <p className="text-muted-foreground">No se encontró la compra.</p>
    )
  }

  return (
    <div className="space-y-5">
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
            {movements.map((m) => {
              const isInPaid = isDateInPaidCycle(m.date, cycles)
              // Show postpone controls when: cardAccount is available, cuota is not in a paid cycle
              const showPostpone = !!cardAccount && !isInPaid && !ms.selectionMode

              return (
                <CuotaRow
                  key={m.id}
                  movement={m}
                  currency={currency}
                  onDelete={setDeletingCuota}
                  selectionMode={ms.selectionMode}
                  isSelected={ms.isSelected(m.id)}
                  onToggle={ms.toggle}
                  isDemo={isDemo}
                  postponeControls={
                    showPostpone ? (
                      <PostponeControls
                        movement={m}
                        allMovements={movements}
                        cycles={cycles}
                        purchaseId={purchaseId}
                        startDate={purchase.start_date}
                        isDemo={isDemo}
                      />
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Edit purchase action */}
      <Button
        variant="outline"
        onClick={() => setEditPurchaseOpen(true)}
        disabled={isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
        className="w-full press-effect flex items-center gap-2"
      >
        <Pencil className="h-4 w-4" />
        Editar compra
      </Button>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Danger zone</p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeletePurchaseOpen(true)}
          disabled={isDemo}
          title={isDemo ? "No disponible en el modo demo" : undefined}
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
        onDeleted={() => setDeletePurchaseOpen(false)}
        isDemo={isDemo}
      />

      {deletingCuota && (
        <DeleteCuotaDialog
          movement={deletingCuota}
          open={!!deletingCuota}
          onOpenChange={(v) => { if (!v) setDeletingCuota(null) }}
          isDemo={isDemo}
        />
      )}

      {/* Edit purchase sheet */}
      {editPurchaseOpen && movements && (
        <EditPurchaseSheet
          purchase={purchase}
          movements={movements}
          cycles={cycles}
          availableAccounts={accounts}
          availableCategories={categories}
          open={editPurchaseOpen}
          onOpenChange={setEditPurchaseOpen}
          isDemo={isDemo}
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
        compact
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar cuotas"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkPending}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkPending || isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="press-effect">
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

// ── Main component (full-page route) ───────────────────────────────────────────

export function InstallmentDetail({ purchaseId }: { purchaseId: string }) {
  const router = useRouter()
  const isDemo = useIsDemo()
  const [deletePurchaseOpen, setDeletePurchaseOpen] = useState(false)

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["installment_purchase", purchaseId],
    queryFn: () => fetchPurchase(purchaseId),
  })

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
          onClick={isDemo ? undefined : () => setDeletePurchaseOpen(true)}
          disabled={isDemo}
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            "transition-all duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
          aria-label="Eliminar compra completa"
          title={isDemo ? "No disponible en el modo demo" : "Eliminar compra completa"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <InstallmentDetailBody purchaseId={purchaseId} />

      {/* Delete purchase dialog (for the header button — body has its own) */}
      <DeletePurchaseDialog
        purchase={purchase}
        open={deletePurchaseOpen}
        onOpenChange={setDeletePurchaseOpen}
        onDeleted={() => router.push("/movimientos")}
        isDemo={isDemo}
      />
    </div>
  )
}
