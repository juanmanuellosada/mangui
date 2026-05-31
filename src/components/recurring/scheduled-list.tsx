"use client"

import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  PlusCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MangoSelect } from "@/components/ui/mango-select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import type { Tables, Enums } from "@/lib/database.types"
import { SCHEDULED_KEY } from "@/lib/recurring"
import { MOVEMENTS_KEY, TRANSFERS_KEY, BALANCES_KEY, ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { PendingInbox } from "./pending-inbox"
import type { OccurrenceWithRec } from "./pending-inbox"

type ScheduledTransaction = Tables<"scheduled_transactions">
type Category = Tables<"categories">
type TxnKind = Enums<"txn_kind">

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchScheduled(): Promise<ScheduledTransaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("scheduled_transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("accounts").select("*").order("created_at")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*").order("name")
  if (error) throw error
  return data
}

async function fetchPendingOccurrences(): Promise<OccurrenceWithRec[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select("*, recurring:recurring_transactions(*)")
    .eq("status", "pending")
    .lte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
  if (error) throw error
  return (data ?? []) as OccurrenceWithRec[]
}

async function fetchPendingScheduled(): Promise<ScheduledTransaction[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]
  const { data, error } = await supabase
    .from("scheduled_transactions")
    .select("*")
    .eq("status", "pending")
    .lte("date", today)
    .order("date", { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Confirm/reject mutations (standalone, used in row) ────────────────────────

async function confirmScheduled(
  txn: ScheduledTransaction,
  accounts: Account[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

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

  const { error } = await supabase
    .from("scheduled_transactions")
    .update({
      status: "executed",
      movement_id: movementId,
      transfer_id: transferId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txn.id)
  if (error) throw error
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: "Pendiente", class: "bg-accent/15 text-accent" },
    executed: { label: "Ejecutada", class: "bg-success/10 text-success" },
    rejected: { label: "Rechazada", class: "bg-destructive/10 text-destructive" },
  }[status] ?? { label: status, class: "bg-muted text-muted-foreground" }

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold", config.class)}>
      {config.label}
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ScheduledRow({
  txn,
  accounts,
  categories,
  onDelete,
}: {
  txn: ScheduledTransaction
  accounts: Account[]
  categories: Category[]
  onDelete: (t: ScheduledTransaction) => void
}) {
  const queryClient = useQueryClient()
  const account = accounts.find((a) => a.id === txn.account_id)
  const category = categories.find((c) => c.id === txn.category_id)
  const formattedDate = format(parseISO(txn.date), "d MMM yyyy", { locale: es })

  const confirmMutation = useMutation({
    mutationFn: () => confirmScheduled(txn, accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULED_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transacción ejecutada")
    },
    onError: (err: Error) => toast.error("Error al confirmar", { description: err.message }),
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
    onError: (err: Error) => toast.error("Error al rechazar", { description: err.message }),
  })

  const isLoading = confirmMutation.isPending || rejectMutation.isPending
  const isPending = txn.status === "pending"

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      {/* Icon */}
      <div
        className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
          txn.kind === "income" ? "bg-success/10" :
          txn.kind === "expense" ? "bg-destructive/10" : "bg-muted"
        )}
      >
        {txn.kind === "income" ? (
          <ArrowUpCircle className="h-5 w-5 text-success" />
        ) : txn.kind === "expense" ? (
          <ArrowDownCircle className="h-5 w-5 text-destructive" />
        ) : (
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className="text-sm font-semibold truncate">
            {txn.note || category?.name || (txn.kind === "income" ? "Ingreso" : txn.kind === "expense" ? "Gasto" : "Transferencia")}
          </p>
          <StatusBadge status={txn.status} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {account?.name ?? "—"} · {formattedDate}
        </p>
      </div>

      {/* Amount */}
      <p
        className={cn(
          "text-sm font-bold tabular-nums flex-shrink-0 mr-2",
          txn.kind === "income" ? "text-success" :
          txn.kind === "expense" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {txn.kind === "income" ? "+ " : txn.kind === "expense" ? "− " : ""}
        {formatCurrency(txn.amount, txn.currency)}
      </p>

      {/* Actions — only for pending */}
      {isPending && (
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
      )}
      {!isPending && (
        <Button
          size="icon-sm"
          variant="ghost"
          title="Eliminar"
          className="press-effect cursor-pointer flex-shrink-0"
          onClick={() => onDelete(txn)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  )
}

// ── Create form schema ────────────────────────────────────────────────────────

type ScheduledFormValues = {
  kind: TxnKind
  amount: number
  currency: "ARS" | "USD"
  account_id: string
  to_account_id: string | null
  to_amount: number | null
  category_id: string | null
  note: string
  date: string
}

const scheduledSchema = z.object({
  kind: z.enum(["income", "expense", "transfer"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency: z.enum(["ARS", "USD"]),
  account_id: z.string().min(1, "Seleccioná una cuenta"),
  to_account_id: z.string().nullable(),
  to_amount: z.coerce.number().nullable(),
  category_id: z.string().nullable(),
  note: z.string(),
  date: z.string().min(1, "Seleccioná una fecha"),
})

function CreateScheduledDialog({
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  accounts: Account[]
  categories: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ScheduledFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(scheduledSchema) as unknown as Resolver<ScheduledFormValues, any>,
    defaultValues: {
      kind: "expense",
      amount: 0,
      currency: "ARS",
      account_id: accounts[0]?.id ?? "",
      to_account_id: null,
      to_amount: null,
      category_id: null,
      note: "",
      date: tomorrowStr,
    },
  })

  const kind = watch("kind")
  const currency = watch("currency")
  const accountId = watch("account_id")
  const toAccountId = watch("to_account_id")
  const toAmount = watch("to_amount")

  const isTransfer = kind === "transfer"
  const filteredCategories = categories.filter((c) =>
    kind === "income" ? c.type === "income" : c.type === "expense"
  )

  const mutation = useMutation({
    mutationFn: async (values: ScheduledFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase.from("scheduled_transactions").insert({
        user_id: user.id,
        kind: values.kind,
        amount: values.amount,
        currency: values.currency,
        account_id: values.account_id,
        to_account_id: values.kind === "transfer" ? values.to_account_id : null,
        to_amount: values.kind === "transfer" ? values.to_amount : null,
        category_id: values.category_id,
        note: values.note || null,
        date: values.date,
        status: "pending",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULED_KEY })
      toast.success("Transacción programada creada")
      reset()
      onOpenChange(false)
    },
    onError: (err: Error) => toast.error("Error al crear", { description: err.message }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva programada</DialogTitle>
          <DialogDescription>
            Programá una transacción para una fecha futura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(async (v) => mutation.mutateAsync(v))} className="space-y-4">
          {/* Kind */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {(["expense", "income", "transfer"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setValue("kind", k)
                  setValue("category_id", null)
                  if (k !== "transfer") { setValue("to_account_id", null); setValue("to_amount", null) }
                }}
                className={cn(
                  "flex-1 h-9 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer press-effect",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  kind === k
                    ? k === "income" ? "bg-success text-white shadow-sm"
                    : k === "expense" ? "bg-destructive text-white shadow-sm"
                    : "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "income" ? "Ingreso" : k === "expense" ? "Gasto" : "Transferencia"}
              </button>
            ))}
          </div>

          {/* Amount + currency */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-amount" className="text-xs text-muted-foreground font-medium">Monto</Label>
            <div className="relative">
              <MoneyInput
                id="sc-amount"
                step="0.01"
                min="0.01"
                placeholder="0"
                currency={currency}
                className="text-2xl font-bold tabular-nums h-14 rounded-xl border-border/60 pr-32 w-full"
                {...register("amount")}
                aria-invalid={!!errors.amount}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <MangoSelect
                  value={currency}
                  onChange={(v) => setValue("currency", v as "ARS" | "USD")}
                  options={[
                    { value: "ARS", label: "ARS", leading: <span className="text-sm" aria-hidden>🇦🇷</span> },
                    { value: "USD", label: "US$", leading: <span className="text-sm" aria-hidden>🇺🇸</span> },
                  ]}
                  className="w-28"
                  triggerClassName="h-8 text-xs font-bold border-border/60 bg-muted/50"
                  aria-label="Moneda"
                />
              </div>
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {/* Account */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">
              {isTransfer ? "Cuenta origen" : "Cuenta"}
            </Label>
            <MangoSelect
              value={accountId}
              onChange={(v) => v && setValue("account_id", v)}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
              placeholder="Seleccioná cuenta"
              aria-invalid={!!errors.account_id}
            />
            {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
          </div>

          {/* Transfer destination */}
          {isTransfer && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Cuenta destino</Label>
                <MangoSelect
                  value={toAccountId ?? ""}
                  onChange={(v) => v && setValue("to_account_id", v)}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.currency})`,
                    disabled: a.id === accountId,
                  }))}
                  placeholder="Seleccioná cuenta destino"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-to-amount" className="text-xs text-muted-foreground font-medium">Monto destino</Label>
                <MoneyInput
                  id="sc-to-amount"
                  step="0.01"
                  placeholder="0,00"
                  currency={currency}
                  className="tabular-nums w-full"
                  value={toAmount ?? ""}
                  onChange={(e) => setValue("to_amount", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </>
          )}

          {/* Category */}
          {!isTransfer && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Categoría</Label>
              <MangoSelect
                value={watch("category_id") ?? "none"}
                onChange={(v) => setValue("category_id", v === "none" ? null : v)}
                options={[
                  { value: "none", label: "Sin categoría" },
                  ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                placeholder="Sin categoría"
              />
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-date" className="text-xs text-muted-foreground font-medium">Fecha</Label>
            <Input
              id="sc-date"
              type="date"
              {...register("date")}
              aria-invalid={!!errors.date}
              className="text-sm"
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-note" className="text-xs text-muted-foreground font-medium">Nota (opcional)</Label>
            <Input
              id="sc-note"
              placeholder="Ej: pago de impuesto, renovación seguro…"
              {...register("note")}
              maxLength={200}
            />
          </div>

          <Button
            type="submit"
            className="w-full press-effect font-semibold h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Guardando…" : "Guardar programada"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteScheduledDialog({
  txn,
  open,
  onOpenChange,
}: {
  txn: ScheduledTransaction
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("scheduled_transactions")
        .delete()
        .eq("id", txn.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULED_KEY })
      toast.success("Programada eliminada")
      onOpenChange(false)
    },
    onError: (err: Error) => toast.error("Error al eliminar", { description: err.message }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar programada</DialogTitle>
          <DialogDescription>¿Estás seguro? Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
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

// ── Main component ─────────────────────────────────────────────────────────────

type StatusFilter = "all" | "pending" | "executed" | "rejected"

export function ScheduledList() {
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingTxn, setDeletingTxn] = useState<ScheduledTransaction | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: SCHEDULED_KEY,
    queryFn: fetchScheduled,
  })

  const { data: pendingOccurrences = [] } = useQuery({
    queryKey: ["recurring_occurrences", "pending"],
    queryFn: fetchPendingOccurrences,
  })

  const { data: pendingScheduled = [] } = useQuery({
    queryKey: [...SCHEDULED_KEY, "pending"],
    queryFn: fetchPendingScheduled,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const filtered = useMemo(() => {
    if (statusFilter === "all") return scheduled
    return scheduled.filter((t) => t.status === statusFilter)
  }, [scheduled, statusFilter])

  const STATUS_FILTERS: Record<StatusFilter, string> = {
    all: "Todas",
    pending: "Pendientes",
    executed: "Ejecutadas",
    rejected: "Rechazadas",
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Programadas
        </h1>
        <div className="hidden lg:block">
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 press-effect font-semibold shadow-sm shadow-primary/20"
          >
            <PlusCircle className="h-4 w-4" />
            Nueva programada
          </Button>
        </div>
      </div>

      {/* Pending inbox (shared component) */}
      <PendingInbox
        occurrences={pendingOccurrences}
        scheduledTxns={pendingScheduled}
        accounts={accounts}
        categories={categories}
      />

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(Object.entries(STATUS_FILTERS) as [StatusFilter, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 press-effect cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              statusFilter === value
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Label */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Programadas
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <CalendarClock className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              {statusFilter === "all" ? "Sin programadas" : "Sin resultados"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {statusFilter === "all"
                ? "Programá transacciones para fechas futuras."
                : "Probá con otro filtro."}
            </p>
          </div>
          {statusFilter === "all" && (
            <Button onClick={() => setCreateOpen(true)} className="press-effect gap-2">
              <PlusCircle className="h-4 w-4" />
              Nueva programada
            </Button>
          )}
        </div>
      )}

      {/* List */}
      {!isLoading && filtered.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
          {filtered.map((t) => (
            <ScheduledRow
              key={t.id}
              txn={t}
              accounts={accounts}
              categories={categories}
              onDelete={setDeletingTxn}
            />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className={cn(
          "lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] right-4 z-30",
          "w-14 h-14 rounded-full bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/35 press-effect",
          "flex items-center justify-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        aria-label="Nueva programada"
      >
        <PlusCircle className="h-6 w-6" />
      </button>

      <CreateScheduledDialog
        accounts={accounts}
        categories={categories}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {deletingTxn && (
        <DeleteScheduledDialog
          txn={deletingTxn}
          open={!!deletingTxn}
          onOpenChange={(v) => { if (!v) setDeletingTxn(null) }}
        />
      )}
    </div>
  )
}
