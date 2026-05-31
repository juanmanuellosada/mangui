"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CreditCard,
  ChevronLeft,
  Calendar,
  ShoppingBag,
  CheckCircle2,
  Clock,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoSelect } from "@/components/ui/mango-select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  nextCloseDate,
  computeDueDate,
  currentCycleRange,
  isInCycle,
  toDateString,
} from "@/lib/cards"
import { ACCOUNTS_KEY, BALANCES_KEY } from "@/lib/movements"
import type { Tables } from "@/lib/database.types"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

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

async function fetchAllAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
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

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
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
    .limit(6)
  if (error) throw error
  return data
}

// ── Register payment dialog ────────────────────────────────────────────────────

function RegisterPaymentDialog({
  account,
  cycleClose,
  cycleDue,
  cycleTotal,
  allAccounts,
  open,
  onOpenChange,
}: {
  account: Account
  cycleClose: Date
  cycleDue: Date
  cycleTotal: number
  allAccounts: Account[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [paidAmount, setPaidAmount] = useState(String(cycleTotal.toFixed(2)))
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0])
  const [paidFromAccountId, setPaidFromAccountId] = useState(
    allAccounts.find((a) => a.id !== account.id && a.type !== "tarjeta_credito")?.id ?? ""
  )

  const otherAccounts = allAccounts.filter(
    (a) => a.id !== account.id && a.type !== "tarjeta_credito"
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { error } = await supabase
        .from("card_statements")
        .upsert(
          {
            user_id: user.id,
            account_id: account.id,
            close_date: toDateString(cycleClose),
            due_date: toDateString(cycleDue),
            total_amount: cycleTotal,
            stamp_tax: 0,
            status: "pagado",
            paid_amount: parseFloat(paidAmount) || cycleTotal,
            paid_date: paidDate,
            paid_from_account_id: paidFromAccountId || null,
            // TODO: link to actual transfer movement when transfer flow is integrated
          },
          { onConflict: "account_id,close_date" }
        )
      if (error) throw error
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Registrá el pago del resumen de {account.name}
            {" · "}cierre {format(cycleClose, "d MMM", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">
              Monto pagado
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="pl-7 tabular-nums font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">
              Fecha de pago
            </Label>
            <Input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="text-sm"
            />
          </div>

          {otherAccounts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Pagado desde
              </Label>
              <MangoSelect
                value={paidFromAccountId}
                onChange={(v) => setPaidFromAccountId(v ?? "")}
                options={[
                  { value: "none-selected", label: "Sin especificar" },
                  ...otherAccounts.map((a) => ({ value: a.id, label: a.name })),
                ]}
                placeholder="Cuenta origen"
              />
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total resumen</span>
              <span className="tabular-nums font-semibold">
                {formatCurrency(cycleTotal, account.currency)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Vencimiento</span>
              <span className="tabular-nums">
                {format(cycleDue, "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 press-effect"
          >
            {mutation.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Card visual ────────────────────────────────────────────────────────────────

function CreditCardVisual({
  account,
  cycleTotal,
  nextClose,
  nextDue,
}: {
  account: Account
  cycleTotal: number
  nextClose: Date
  nextDue: Date
}) {
  const cardColor = account.color ?? "#65a30d"

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${cardColor}dd, ${cardColor}88)`,
      }}
    >
      {/* Decorative circle */}
      <div
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20"
        style={{ background: "white" }}
        aria-hidden
      />
      <div
        className="absolute -right-4 top-8 h-20 w-20 rounded-full opacity-10"
        style={{ background: "white" }}
        aria-hidden
      />

      <div className="relative space-y-4">
        {/* Card name + brand */}
        <div className="flex items-center justify-between">
          <p className="text-white/80 text-sm font-medium">{account.name}</p>
          <CreditCard className="h-6 w-6 text-white/60" />
        </div>

        {/* Total amount */}
        <div>
          <p className="text-white/60 text-xs font-medium mb-0.5">Total resumen actual</p>
          <p
            className="text-white text-3xl font-bold tabular-nums leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {formatCurrency(cycleTotal, account.currency)}
          </p>
        </div>

        {/* Dates */}
        <div className="flex gap-4">
          <div>
            <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">Próximo cierre</p>
            <p className="text-white text-xs font-semibold tabular-nums">
              {format(nextClose, "d MMM", { locale: es })}
            </p>
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider">Vencimiento</p>
            <p className="text-white text-xs font-semibold tabular-nums">
              {format(nextDue, "d MMM", { locale: es })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card detail section ────────────────────────────────────────────────────────

function CardSection({
  account,
  allAccounts,
  categories,
}: {
  account: Account
  allAccounts: Account[]
  categories: Category[]
}) {
  const [paymentOpen, setPaymentOpen] = useState(false)

  const closingDay = account.closing_day ?? 1
  const dueDay = account.due_day ?? 10

  const today = new Date()
  const nextClose = nextCloseDate(closingDay, today)
  const nextDue = computeDueDate(nextClose, dueDay, closingDay)
  const { cycleStart, cycleEnd } = currentCycleRange(closingDay, today)

  const { data: movements = [] } = useQuery({
    queryKey: ["card_movements", account.id],
    queryFn: () => fetchMovementsForCard(account.id),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Movements in the current cycle
  const cycleMovements = movements.filter((m) =>
    isInCycle(m.date, cycleStart, cycleEnd)
  )

  // Total from non-future movements + projected cuotas
  const cycleTotal = cycleMovements.reduce((sum, m) => {
    const amt = m.converted_amount ?? m.amount
    return sum + amt
  }, 0)

  // Cuota movements in this cycle
  const cuotaMovements = cycleMovements.filter((m) => m.installment_purchase_id !== null)

  // Regular (non-cuota) expense movements
  const regularMovements = cycleMovements.filter((m) => m.installment_purchase_id === null)

  // Fetch existing statement for this cycle
  const cycleCloseStr = toDateString(nextClose)
  const { data: statements = [] } = useQuery({
    queryKey: [...CARD_STATEMENTS_KEY, account.id],
    queryFn: () => fetchStatements(account.id),
  })
  const existingStatement = statements.find((s) => s.close_date === cycleCloseStr)
  const isPaid = existingStatement?.status === "pagado"

  return (
    <div className="space-y-5">
      {/* Card visual */}
      <CreditCardVisual
        account={account}
        cycleTotal={cycleTotal}
        nextClose={nextClose}
        nextDue={nextDue}
      />

      {/* Cuotas this month */}
      {cuotaMovements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
            Cuotas que caen este mes
          </p>
          <div className="flex flex-wrap gap-2">
            {cuotaMovements.map((m) => {
              const cat = m.category_id ? categoryMap.get(m.category_id) : undefined
              return (
                <Link
                  key={m.id}
                  href={`/app/cuotas/${m.installment_purchase_id}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
                    "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    "transition-colors duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    m.is_future && "opacity-70 italic"
                  )}
                >
                  <span className="tabular-nums">
                    Cuota {m.installment_number}/{m.installment_total}
                  </span>
                  {cat && <span>· {cat.name}</span>}
                  <span className="tabular-nums font-bold">
                    {formatCurrency(m.converted_amount ?? m.amount, account.currency)}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Gastos del ciclo */}
      {regularMovements.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Gastos del ciclo
            </p>
            <Link
              href={`/app/movements?account=${account.id}`}
              className="text-xs text-primary hover:underline font-medium"
            >
              Ver todos
            </Link>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {regularMovements.slice(0, 8).map((m) => {
              const cat = m.category_id ? categoryMap.get(m.category_id) : undefined
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {cat?.name ?? "Sin categoría"}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {format(parseISO(m.date), "d MMM", { locale: es })}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
                    − {formatCurrency(m.converted_amount ?? m.amount, account.currency)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Register payment CTA */}
      <div className="pt-1">
        {isPaid ? (
          <div className="flex items-center gap-2 justify-center py-3 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <p className="text-sm font-semibold text-success">
              Pago registrado —{" "}
              {existingStatement?.paid_amount !== null && existingStatement?.paid_amount !== undefined
                ? formatCurrency(existingStatement.paid_amount, account.currency)
                : ""}
            </p>
          </div>
        ) : (
          <Button
            onClick={() => setPaymentOpen(true)}
            className="w-full press-effect font-semibold h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
          >
            Registrar pago
          </Button>
        )}
      </div>

      {paymentOpen && (
        <RegisterPaymentDialog
          account={account}
          cycleClose={nextClose}
          cycleDue={nextDue}
          cycleTotal={cycleTotal}
          allAccounts={allAccounts}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
        />
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CardSectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CardsList() {
  const { data: cards, isLoading: loadingCards } = useQuery({
    queryKey: ["credit_card_accounts"],
    queryFn: fetchCreditCardAccounts,
  })

  const { data: allAccounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAllAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select first card
  const displayCard =
    selectedId !== null
      ? cards?.find((c) => c.id === selectedId) ?? cards?.[0]
      : cards?.[0]

  return (
    <div className="space-y-5 max-w-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Tarjetas
        </h1>
        {cards && cards.length > 1 && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
            {cards.length} tarjetas
          </span>
        )}
      </div>

      {/* Loading */}
      {loadingCards && <CardSectionSkeleton />}

      {/* Empty state */}
      {!loadingCards && (!cards || cards.length === 0) && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No tenés tarjetas de crédito
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Agregá una tarjeta de crédito en tus cuentas para ver los resúmenes y cuotas.
            </p>
          </div>
          <Link
            href="/app/accounts"
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold",
              "bg-primary text-primary-foreground shadow-sm shadow-primary/20 press-effect",
              "hover:bg-primary/90 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Plus className="h-4 w-4" />
            Agregar cuenta
          </Link>
        </div>
      )}

      {/* Card selector tabs (if multiple cards) */}
      {!loadingCards && cards && cards.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedId(card.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0",
                "transition-all duration-150 press-effect cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                displayCard?.id === card.id
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <CreditCard className="h-3 w-3" />
              {card.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected card detail */}
      {!loadingCards && displayCard && (
        <CardSection
          account={displayCard}
          allAccounts={allAccounts}
          categories={categories}
        />
      )}
    </div>
  )
}
