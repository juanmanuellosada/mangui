"use client"

import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import {
  PlusCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  CreditCard,
  Repeat,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  RECURRING_KEY,
  OCCURRENCES_KEY,
  SCHEDULED_KEY,
  frequencyLabel,
  computeNextRun,
  type RecurringTransaction,
} from "@/lib/recurring"
import { ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { PendingInbox, type OccurrenceWithRec } from "./pending-inbox"
import { RecurringForm, recurringToFormValues, type RecurringFormValues } from "./recurring-form"

type Category = Tables<"categories">
type ScheduledTransaction = Tables<"scheduled_transactions">

export type { OccurrenceWithRec }

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .order("created_at", { ascending: false })
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

// ── Recurring row ─────────────────────────────────────────────────────────────

function RecurringRow({
  rec,
  accounts,
  onEdit,
}: {
  rec: RecurringTransaction
  accounts: Account[]
  onEdit: (r: RecurringTransaction) => void
}) {
  const queryClient = useQueryClient()

  const account = accounts.find((a) => a.id === rec.account_id)
  const nextRun = rec.next_run
    ? format(parseISO(rec.next_run), "d MMM yyyy", { locale: es })
    : "—"

  const statusMutation = useMutation({
    mutationFn: async (newStatus: "active" | "paused") => {
      const supabase = createClient()
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", rec.id)
      if (error) throw error
    },
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: RECURRING_KEY })
      const prev = queryClient.getQueryData<RecurringTransaction[]>(RECURRING_KEY)
      queryClient.setQueryData<RecurringTransaction[]>(RECURRING_KEY, (old = []) =>
        old.map((r) => (r.id === rec.id ? { ...r, status: newStatus } : r))
      )
      return { prev }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(RECURRING_KEY, context.prev)
      toast.error("Error al actualizar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
    },
  })

  return (
    <button
      type="button"
      className="flex items-center gap-3 py-3 px-4 w-full text-left hover:bg-muted/40 transition-colors duration-150 cursor-pointer group"
      onClick={() => onEdit(rec)}
    >
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
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className="text-sm font-semibold truncate">
            {rec.note || (rec.kind === "income" ? "Ingreso" : rec.kind === "expense" ? "Gasto" : "Transferencia")}
          </p>
          {rec.is_card_recurring && (
            <CreditCard className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          {rec.status === "paused" && (
            <span className="inline-flex items-center px-1.5 py-0 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
              Pausada
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {frequencyLabel(rec)} · Próx: {nextRun}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0 mr-2">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            rec.kind === "income" ? "text-success" :
            rec.kind === "expense" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {rec.kind === "income" ? "+ " : rec.kind === "expense" ? "− " : ""}
          {formatCurrency(rec.amount, rec.currency)}
        </p>
      </div>

      {/* Status switch */}
      <div
        className="flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          const newStatus = rec.status === "active" ? "paused" : "active"
          statusMutation.mutate(newStatus)
        }}
      >
        <Switch
          checked={rec.status === "active"}
          disabled={statusMutation.isPending}
          aria-label={rec.status === "active" ? "Pausar recurrente" : "Activar recurrente"}
        />
      </div>
    </button>
  )
}

// ── Filter chips ──────────────────────────────────────────────────────────────

type Filter = "all" | "active" | "paused" | "income" | "expense" | "transfer" | "card"

const FILTER_LABELS: Record<Filter, string> = {
  all: "Todas",
  active: "Activas",
  paused: "Pausadas",
  income: "Ingresos",
  expense: "Gastos",
  transfer: "Transferencias",
  card: "Tarjeta",
}

// ── Edit/Create dialog ────────────────────────────────────────────────────────

function RecurringDialog({
  rec,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  rec: RecurringTransaction | null
  accounts: Account[]
  categories: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (values: RecurringFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      // Compute next_run
      const fakeRec = {
        ...values,
        account_id: values.account_id,
        id: "",
        created_at: "",
        updated_at: "",
        user_id: user.id,
        status: "active" as const,
        next_run: null,
        end_date: values.end_date,
      } as RecurringTransaction
      const from = startOfDay(parseISO(values.start_date))
      const nextRun = computeNextRun(fakeRec, from)
      const nextRunStr = nextRun.toISOString().split("T")[0]

      const { error } = await supabase.from("recurring_transactions").insert({
        user_id: user.id,
        kind: values.kind,
        amount: values.amount,
        currency: values.currency,
        account_id: values.account_id,
        to_account_id: values.kind === "transfer" ? values.to_account_id : null,
        to_amount: values.kind === "transfer" ? values.to_amount : null,
        category_id: values.category_id,
        note: values.note || null,
        frequency: values.frequency,
        day_of_week: values.day_of_week,
        day_of_month: values.day_of_month,
        month_of_year: values.month_of_year,
        weekend_handling: values.weekend_handling,
        start_date: values.start_date,
        end_date: values.end_date || null,
        is_card_recurring: values.is_card_recurring,
        next_run: nextRunStr,
        status: "active",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
      toast.success("Recurrente creada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear", { description: err.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: RecurringFormValues) => {
      if (!rec) return
      const supabase = createClient()

      const fakeRec = { ...rec, ...values } as RecurringTransaction
      const from = startOfDay(parseISO(values.start_date))
      const nextRun = computeNextRun(fakeRec, from)
      const nextRunStr = nextRun.toISOString().split("T")[0]

      const { error } = await supabase
        .from("recurring_transactions")
        .update({
          kind: values.kind,
          amount: values.amount,
          currency: values.currency,
          account_id: values.account_id,
          to_account_id: values.kind === "transfer" ? values.to_account_id : null,
          to_amount: values.kind === "transfer" ? values.to_amount : null,
          category_id: values.category_id,
          note: values.note || null,
          frequency: values.frequency,
          day_of_week: values.day_of_week,
          day_of_month: values.day_of_month,
          month_of_year: values.month_of_year,
          weekend_handling: values.weekend_handling,
          start_date: values.start_date,
          end_date: values.end_date || null,
          is_card_recurring: values.is_card_recurring,
          next_run: nextRunStr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
      toast.success("Recurrente actualizada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al actualizar", { description: err.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!rec) return
      const supabase = createClient()
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", rec.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
      queryClient.invalidateQueries({ queryKey: OCCURRENCES_KEY })
      toast.success("Recurrente eliminada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar", { description: err.message })
    },
  })

  const isEditing = !!rec
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar recurrente" : "Nueva recurrente"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modificá los datos de la transacción recurrente."
              : "Configurá una transacción que se repite automáticamente."}
          </DialogDescription>
        </DialogHeader>
        <RecurringForm
          accounts={accounts}
          categories={categories}
          defaultValues={rec ? recurringToFormValues(rec) : undefined}
          onSubmit={async (v) => {
            if (isEditing) await updateMutation.mutateAsync(v)
            else await createMutation.mutateAsync(v)
          }}
          onDelete={isEditing ? async () => deleteMutation.mutate() : undefined}
          isLoading={isPending}
          isDeleting={deleteMutation.isPending}
          submitLabel={isEditing ? "Guardar cambios" : "Guardar recurrente"}
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RecurringList() {
  const [filter, setFilter] = useState<Filter>("all")
  const [editingRec, setEditingRec] = useState<RecurringTransaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: recurring = [], isLoading: loadingRec } = useQuery({
    queryKey: RECURRING_KEY,
    queryFn: fetchRecurring,
  })

  const { data: occurrences = [] } = useQuery({
    queryKey: [...OCCURRENCES_KEY, "pending"],
    queryFn: fetchPendingOccurrences,
  })

  const { data: scheduled = [] } = useQuery({
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
    return recurring.filter((r) => {
      if (filter === "all") return true
      if (filter === "active") return r.status === "active"
      if (filter === "paused") return r.status === "paused"
      if (filter === "income") return r.kind === "income"
      if (filter === "expense") return r.kind === "expense"
      if (filter === "transfer") return r.kind === "transfer"
      if (filter === "card") return r.is_card_recurring
      return true
    })
  }, [recurring, filter])

  const openCreate = () => {
    setEditingRec(null)
    setDialogOpen(true)
  }

  const openEdit = (r: RecurringTransaction) => {
    setEditingRec(r)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Recurrentes
        </h1>
        <div className="hidden lg:block">
          <Button
            onClick={openCreate}
            className="gap-2 press-effect font-semibold shadow-sm shadow-primary/20"
          >
            <PlusCircle className="h-4 w-4" />
            Nueva recurrente
          </Button>
        </div>
      </div>

      {/* Pending inbox */}
      <PendingInbox
        occurrences={occurrences}
        scheduledTxns={scheduled}
        accounts={accounts}
        categories={categories}
      />

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(Object.entries(FILTER_LABELS) as [Filter, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 press-effect cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === value
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loadingRec && (
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
      {!loadingRec && filtered.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Repeat className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              {filter === "all" ? "Sin recurrentes" : "Sin resultados"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {filter === "all"
                ? "Creá una transacción recurrente para automatizar pagos e ingresos."
                : "Probá con otro filtro."}
            </p>
          </div>
          {filter === "all" && (
            <Button onClick={openCreate} className="press-effect gap-2">
              <PlusCircle className="h-4 w-4" />
              Nueva recurrente
            </Button>
          )}
        </div>
      )}

      {/* List */}
      {!loadingRec && filtered.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
          {filtered.map((r) => (
            <RecurringRow
              key={r.id}
              rec={r}
              accounts={accounts}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={openCreate}
        className={cn(
          "lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] right-4 z-30",
          "w-14 h-14 rounded-full bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/35 press-effect",
          "flex items-center justify-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        aria-label="Nueva recurrente"
      >
        <PlusCircle className="h-6 w-6" />
      </button>

      {/* Dialog */}
      <RecurringDialog
        rec={editingRec}
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditingRec(null)
        }}
      />
    </div>
  )
}
