"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Clock, ChevronRight, ArrowUpCircle, ArrowDownCircle, PlusCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import type { Tables } from "@/lib/database.types"
import { MOVEMENTS_KEY, BALANCES_KEY, ACCOUNTS_KEY } from "@/lib/movements"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { MovementForm, type MovementFormValues } from "@/components/movements/movement-form"
import type { Account } from "@/lib/accounts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useMutation } from "@tanstack/react-query"

type Movement = Tables<"movements">
type Category = Tables<"categories">

async function fetchRecentMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5)
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

function formatDateShort(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return "Hoy"
  if (isYesterday(d)) return "Ayer"
  return format(d, "d MMM", { locale: es })
}

function QuickAddDialog({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              buttonVariants({ size: "sm" }),
              "gap-1.5 cursor-pointer"
            )}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Nuevo
          </button>
        }
      />
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>
            Registrá un ingreso o gasto en una de tus cuentas.
          </DialogDescription>
        </DialogHeader>
        <MovementForm
          accounts={accounts}
          categories={categories}
          onSubmit={async (v) => { await mutation.mutateAsync(v) }}
          isLoading={mutation.isPending}
          submitLabel="Crear movimiento"
        />
      </DialogContent>
    </Dialog>
  )
}

export function RecentMovements() {
  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: MOVEMENTS_KEY,
    queryFn: fetchRecentMovements,
    staleTime: 60 * 1000,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">Últimos movimientos</h3>
        </div>
        {accounts.length > 0 && (
          <QuickAddDialog accounts={accounts} categories={categories} />
        )}
      </div>

      {loadingMovements && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      )}

      {!loadingMovements && (!movements || movements.length === 0) && (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Sin movimientos todavía.
          </p>
        </div>
      )}

      {!loadingMovements && movements && movements.length > 0 && (
        <div className="space-y-1">
          {movements.map((m) => {
            const isIncome = m.type === "income"
            const account = accountMap.get(m.account_id)
            const category = m.category_id ? categoryMap.get(m.category_id) : undefined
            const displayAmount = m.converted_amount ?? m.amount
            const displayCurrency = account?.currency ?? m.original_currency

            return (
              <div
                key={m.id}
                className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted/30 transition-colors duration-150 px-1"
              >
                <div
                  className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    isIncome ? "bg-success/10" : "bg-destructive/10"
                  )}
                >
                  {isIncome ? (
                    <ArrowUpCircle className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {category?.name ?? "Sin categoría"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {account?.name ?? "—"} · {formatDateShort(m.date)}
                  </p>
                </div>

                <p
                  className={cn(
                    "text-xs font-semibold tabular-nums flex-shrink-0",
                    isIncome ? "text-success" : "text-destructive"
                  )}
                >
                  {isIncome ? "+" : "−"}
                  {formatCurrency(displayAmount, displayCurrency)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/app/movements"
        className="flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver todos
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
