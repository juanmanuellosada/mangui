"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Pencil,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  CalendarClock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  RECURRING_KEY,
  OCCURRENCES_KEY,
  SCHEDULED_KEY,
} from "@/lib/recurring"
import { MOVEMENTS_KEY, TRANSFERS_KEY, BALANCES_KEY, ACCOUNTS_KEY } from "@/lib/movements"

type RecurringOccurrence = Tables<"recurring_occurrences">
type RecurringTransaction = Tables<"recurring_transactions">
type ScheduledTransaction = Tables<"scheduled_transactions">
type Category = Tables<"categories">

export type OccurrenceWithRec = RecurringOccurrence & {
  recurring: RecurringTransaction
}

interface PendingInboxProps {
  occurrences: OccurrenceWithRec[]
  scheduledTxns: ScheduledTransaction[]
  accounts: Account[]
  categories: Category[]
}

// ── Confirm occurrence ─────────────────────────────────────────────────────────

async function confirmOccurrence(
  occ: OccurrenceWithRec,
  accounts: Account[],
  overrideAmount?: number
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const rec = occ.recurring
  const finalAmount = overrideAmount ?? occ.amount_override ?? rec.amount
  const account = accounts.find((a) => a.id === rec.account_id)

  let movementId: string | null = null
  let transferId: string | null = null

  if (rec.kind === "transfer") {
    const { data, error } = await supabase
      .from("transfers")
      .insert({
        user_id: user.id,
        from_account_id: rec.account_id!,
        to_account_id: rec.to_account_id!,
        from_amount: finalAmount,
        to_amount: rec.to_amount ?? finalAmount,
        date: occ.scheduled_date,
        note: rec.note ?? null,
        is_future: false,
        recurring_id: rec.id,
      })
      .select("id")
      .single()
    if (error) throw error
    transferId = data.id
  } else {
    // Check if cross-currency: account currency vs rec.currency
    const accountCurrency = account?.currency ?? rec.currency
    const isCross = rec.currency !== accountCurrency

    const { data, error } = await supabase
      .from("movements")
      .insert({
        user_id: user.id,
        type: rec.kind as "income" | "expense",
        amount: finalAmount,
        original_currency: rec.currency,
        account_id: rec.account_id!,
        category_id: rec.category_id ?? null,
        date: occ.scheduled_date,
        note: rec.note ?? null,
        is_future: false,
        recurring_id: rec.id,
        // For cross-currency we don't auto-convert here (no rate selected on template)
        converted_amount: null,
        dollar_type: null,
      })
      .select("id")
      .single()
    if (error) throw error
    movementId = data.id
  }

  // Update occurrence
  const { error: occError } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "confirmed",
      movement_id: movementId,
      transfer_id: transferId,
      amount_override: overrideAmount ?? occ.amount_override,
      updated_at: new Date().toISOString(),
    })
    .eq("id", occ.id)
  if (occError) throw occError
}

// ── Confirm scheduled ─────────────────────────────────────────────────────────

async function confirmScheduled(
  txn: ScheduledTransaction,
  accounts: Account[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const account = accounts.find((a) => a.id === txn.account_id)

  let movementId: string | null = null
  let transferId: string | null = null

  if (txn.kind === "transfer") {
    const { data, error } = await supabase
      .from("transfers")
      .insert({
        user_id: user.id,
        from_account_id: txn.account_id!,
        to_account_id: txn.to_account_id!,
        from_amount: txn.amount,
        to_amount: txn.to_amount ?? txn.amount,
        date: txn.date,
        note: txn.note ?? null,
        is_future: false,
      })
      .select("id")
      .single()
    if (error) throw error
    transferId = data.id
  } else {
    const { data, error } = await supabase
      .from("movements")
      .insert({
        user_id: user.id,
        type: txn.kind as "income" | "expense",
        amount: txn.amount,
        original_currency: txn.currency,
        account_id: txn.account_id!,
        category_id: txn.category_id ?? null,
        date: txn.date,
        note: txn.note ?? null,
        is_future: false,
        converted_amount: null,
        dollar_type: null,
      })
      .select("id")
      .single()
    if (error) throw error
    movementId = data.id
  }

  const { error: txnError } = await supabase
    .from("scheduled_transactions")
    .update({
      status: "executed",
      movement_id: movementId,
      transfer_id: transferId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txn.id)
  if (txnError) throw txnError
}

// ── Edit amount dialog ─────────────────────────────────────────────────────────

function EditOccurrenceDialog({
  occ,
  accounts,
  open,
  onOpenChange,
}: {
  occ: OccurrenceWithRec
  accounts: Account[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [overrideAmount, setOverrideAmount] = useState(
    String(occ.amount_override ?? occ.recurring.amount)
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(overrideAmount)
      if (!amt || amt <= 0) throw new Error("Monto inválido")
      await confirmOccurrence(occ, accounts, amt)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OCCURRENCES_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Ocurrencia confirmada con monto editado")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al confirmar", { description: err.message })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar y confirmar</DialogTitle>
          <DialogDescription>
            Ajustá el monto para esta ocurrencia y confirmala.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount" className="text-xs text-muted-foreground font-medium">
              Monto ({occ.recurring.currency})
            </Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              className="tabular-nums"
              value={overrideAmount}
              onChange={(e) => setOverrideAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="press-effect"
          >
            {mutation.isPending ? "Confirmando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Occurrence card ────────────────────────────────────────────────────────────

function OccurrenceCard({
  occ,
  accounts,
}: {
  occ: OccurrenceWithRec
  accounts: Account[]
}) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const rec = occ.recurring
  const displayAmount = occ.amount_override ?? rec.amount
  const formattedDate = format(parseISO(occ.scheduled_date), "d MMM", { locale: es })

  const confirmMutation = useMutation({
    mutationFn: () => confirmOccurrence(occ, accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OCCURRENCES_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento registrado")
    },
    onError: (err: Error) => {
      toast.error("Error al confirmar", { description: err.message })
    },
  })

  const skipMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("recurring_occurrences")
        .update({ status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", occ.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OCCURRENCES_KEY })
      toast.success("Ocurrencia saltada")
    },
    onError: (err: Error) => {
      toast.error("Error al saltar", { description: err.message })
    },
  })

  const isLoading = confirmMutation.isPending || skipMutation.isPending

  return (
    <>
      <div className="flex items-center gap-3 py-3">
        {/* Icon */}
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
            rec.kind === "income" ? "bg-success/10" :
            rec.kind === "expense" ? "bg-destructive/10" : "bg-muted"
          )}
        >
          {rec.kind === "income" ? (
            <ArrowUpCircle className="h-5 w-5 text-success" />
          ) : rec.kind === "expense" ? (
            <ArrowDownCircle className="h-5 w-5 text-destructive" />
          ) : (
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {rec.note || (rec.kind === "income" ? "Ingreso" : rec.kind === "expense" ? "Gasto" : "Transferencia")}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formattedDate}
          </p>
        </div>

        {/* Amount */}
        <p
          className={cn(
            "text-sm font-bold tabular-nums flex-shrink-0",
            rec.kind === "income" ? "text-success" :
            rec.kind === "expense" ? "text-destructive" : "text-foreground"
          )}
        >
          {rec.kind === "income" ? "+ " : rec.kind === "expense" ? "− " : ""}
          {formatCurrency(displayAmount, rec.currency)}
        </p>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="icon-sm"
            variant="ghost"
            title="Editar monto y confirmar"
            className="press-effect cursor-pointer"
            onClick={() => setEditOpen(true)}
            disabled={isLoading}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Saltar"
            className="press-effect cursor-pointer"
            onClick={() => skipMutation.mutate()}
            disabled={isLoading}
          >
            <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Confirmar"
            className="press-effect cursor-pointer"
            onClick={() => confirmMutation.mutate()}
            disabled={isLoading}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          </Button>
        </div>
      </div>

      <EditOccurrenceDialog
        occ={occ}
        accounts={accounts}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}

// ── Scheduled card ─────────────────────────────────────────────────────────────

function ScheduledCard({
  txn,
  accounts,
}: {
  txn: ScheduledTransaction
  accounts: Account[]
}) {
  const queryClient = useQueryClient()

  const formattedDate = format(parseISO(txn.date), "d MMM", { locale: es })

  const confirmMutation = useMutation({
    mutationFn: () => confirmScheduled(txn, accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULED_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transacción programada ejecutada")
    },
    onError: (err: Error) => {
      toast.error("Error al confirmar", { description: err.message })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("scheduled_transactions")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", txn.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULED_KEY })
      toast.success("Transacción rechazada")
    },
    onError: (err: Error) => {
      toast.error("Error al rechazar", { description: err.message })
    },
  })

  const isLoading = confirmMutation.isPending || rejectMutation.isPending

  return (
    <div className="flex items-center gap-3 py-3">
      {/* Icon */}
      <div
        className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
          txn.kind === "income" ? "bg-success/10" :
          txn.kind === "expense" ? "bg-destructive/10" : "bg-muted"
        )}
      >
        <CalendarClock className="h-4.5 w-4.5 text-muted-foreground" style={{ width: "1.125rem", height: "1.125rem" }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {txn.note || (txn.kind === "income" ? "Ingreso" : txn.kind === "expense" ? "Gasto" : "Transferencia")}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">Programada · {formattedDate}</p>
      </div>

      {/* Amount */}
      <p
        className={cn(
          "text-sm font-bold tabular-nums flex-shrink-0",
          txn.kind === "income" ? "text-success" :
          txn.kind === "expense" ? "text-destructive" : "text-foreground"
        )}
      >
        {txn.kind === "income" ? "+ " : txn.kind === "expense" ? "− " : ""}
        {formatCurrency(txn.amount, txn.currency)}
      </p>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <Button
          size="icon-sm"
          variant="ghost"
          title="Rechazar"
          className="press-effect cursor-pointer"
          onClick={() => rejectMutation.mutate()}
          disabled={isLoading}
        >
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Confirmar"
          className="press-effect cursor-pointer"
          onClick={() => confirmMutation.mutate()}
          disabled={isLoading}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        </Button>
      </div>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────────

export function PendingInbox({
  occurrences,
  scheduledTxns,
  accounts,
  categories,
}: PendingInboxProps) {
  if (occurrences.length === 0 && scheduledTxns.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-accent animate-pulse" aria-hidden />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Por confirmar
        </p>
        <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
          {occurrences.length + scheduledTxns.length}
        </span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {occurrences.map((occ) => (
          <div key={occ.id} className="px-4">
            <OccurrenceCard occ={occ} accounts={accounts} />
          </div>
        ))}
        {scheduledTxns.map((txn) => (
          <div key={txn.id} className="px-4">
            <ScheduledCard txn={txn} accounts={accounts} />
          </div>
        ))}
      </div>
    </div>
  )
}
