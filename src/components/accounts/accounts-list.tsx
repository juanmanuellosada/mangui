"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, EyeOff, Briefcase, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountForm, accountToFormValues, type AccountFormValues } from "./account-form"
import {
  ACCOUNT_TYPE_LABELS,
  renderAccountIcon,
  type Account,
  type AccountBalance,
} from "@/lib/accounts"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// ── Query keys ────────────────────────────────────────────────
const ACCOUNTS_KEY = ["accounts"] as const
const BALANCES_KEY = ["account_balances"] as const

// ── Data fetchers ─────────────────────────────────────────────
async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
  if (error) throw error
  return data
}

// ── Sub-components ────────────────────────────────────────────

function AccountCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-24" />
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────
function CreateAccountDialog({ asIconButton = false, userId }: { asIconButton?: boolean; userId?: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { data, error } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          name: values.name,
          type: values.type,
          currency: values.currency,
          initial_balance: values.initial_balance,
          icon: values.icon,
          color: values.color,
          is_hidden: values.is_hidden,
          account_number: values.type !== "tarjeta_credito" && values.account_number ? values.account_number : null,
          closing_day: values.type === "tarjeta_credito" ? (values.closing_day ?? null) : null,
          due_day: values.type === "tarjeta_credito" ? (values.due_day ?? null) : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (newAccount) => {
      queryClient.setQueryData<Account[]>(ACCOUNTS_KEY, (old = []) => [
        ...old,
        newAccount,
      ])
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      toast.success("Cuenta creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la cuenta", { description: err.message })
    },
  })

  return (
    <>
      {asIconButton ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-xl",
            "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
            "press-effect transition-all hover:bg-primary/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          )}
          aria-label="Agregar cuenta"
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} className="gap-2 font-semibold press-effect">
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      )}
      <MangoSheet
        open={open}
        onOpenChange={setOpen}
        title="Nueva cuenta"
        description="Completá los datos para agregar una cuenta a tu perfil."
      >
        <AccountForm
          onSubmit={async (values) => { await mutation.mutateAsync(values) }}
          isLoading={mutation.isPending}
          submitLabel="Crear cuenta"
          userId={userId}
        />
      </MangoSheet>
    </>
  )
}

// ── Edit dialog ───────────────────────────────────────────────
function EditAccountDialog({ account, userId }: { account: Account; userId?: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("accounts")
        .update({
          name: values.name,
          type: values.type,
          currency: values.currency,
          initial_balance: values.initial_balance,
          icon: values.icon,
          color: values.color,
          is_hidden: values.is_hidden,
          account_number: values.type !== "tarjeta_credito" && values.account_number ? values.account_number : null,
          closing_day: values.type === "tarjeta_credito" ? (values.closing_day ?? null) : null,
          due_day: values.type === "tarjeta_credito" ? (values.due_day ?? null) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY })
      const previous = queryClient.getQueryData<Account[]>(ACCOUNTS_KEY)
      queryClient.setQueryData<Account[]>(ACCOUNTS_KEY, (old = []) =>
        old.map((a) =>
          a.id === account.id
            ? {
                ...a,
                name: values.name,
                type: values.type,
                currency: values.currency,
                initial_balance: values.initial_balance,
                icon: values.icon ?? a.icon,
                color: values.color ?? a.color,
                is_hidden: values.is_hidden,
                account_number: values.type !== "tarjeta_credito" && values.account_number ? values.account_number : null,
                closing_day: values.closing_day ?? null,
                due_day: values.due_day ?? null,
              }
            : a
        )
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ACCOUNTS_KEY, context.previous)
      }
      toast.error("Error al actualizar la cuenta", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      toast.success("Cuenta actualizada")
      setOpen(false)
    },
  })

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Editar cuenta"
        className="press-effect cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <MangoSheet
        open={open}
        onOpenChange={setOpen}
        title="Editar cuenta"
        description="Modificá los datos de la cuenta."
      >
        <AccountForm
          defaultValues={accountToFormValues(account)}
          onSubmit={async (values) => { await mutation.mutateAsync(values) }}
          isLoading={mutation.isPending}
          submitLabel="Guardar cambios"
          userId={userId}
        />
      </MangoSheet>
    </>
  )
}

// ── Delete dialog ─────────────────────────────────────────────
function DeleteAccountDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", account.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY })
      const previous = queryClient.getQueryData<Account[]>(ACCOUNTS_KEY)
      queryClient.setQueryData<Account[]>(ACCOUNTS_KEY, (old = []) =>
        old.filter((a) => a.id !== account.id)
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ACCOUNTS_KEY, context.previous)
      }
      const isRestrict =
        err.message.includes("restrict") || err.message.includes("foreign key")
      toast.error(
        isRestrict
          ? "No podés eliminar una cuenta con movimientos"
          : "Error al eliminar la cuenta",
        { description: isRestrict ? undefined : err.message }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      toast.success("Cuenta eliminada")
      setOpen(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon-sm" title="Eliminar cuenta" className="press-effect cursor-pointer">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      } />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar cuenta</DialogTitle>
          <DialogDescription>
            ¿Estás seguro que querés eliminar <strong>{account.name}</strong>? Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
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

// ── Account card ──────────────────────────────────────────────
function AccountCard({
  account,
  balance,
  userId,
}: {
  account: Account
  balance: AccountBalance | undefined
  userId?: string
}) {
  const currentBalance = balance?.current_balance ?? account.initial_balance

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card px-4 py-4 flex items-center gap-3",
        "hover:border-primary/20 hover:shadow-sm transition-all duration-150",
        account.is_hidden && "opacity-60"
      )}
    >
      {/* Icon */}
      <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/60 overflow-hidden">
        {renderAccountIcon(account.icon, { size: "h-6 w-6", className: "text-muted-foreground", logoFill: true })}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-semibold truncate">{account.name}</p>
          {account.is_hidden && (
            <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0 rounded-md text-[10px] font-bold uppercase tracking-wider",
              "bg-muted text-muted-foreground"
            )}
          >
            {account.currency}
          </span>
        </div>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0 mr-1">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            currentBalance < 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {formatCurrency(currentBalance, account.currency)}
        </p>
      </div>

      {/* Credit card shortcut */}
      {account.type === "tarjeta_credito" && (
        <Link
          href="/app/cards"
          className={cn(
            "flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center",
            "text-primary hover:bg-primary/10 transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          )}
          title="Ver resumen"
          aria-label="Ver resumen de tarjeta"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      {/* Actions */}
      <div className="flex gap-0.5 flex-shrink-0">
        <EditAccountDialog account={account} userId={userId} />
        <DeleteAccountDialog account={account} />
      </div>
    </div>
  )
}

// ── Patrimonio total hero card ────────────────────────────────
function PatrimonioCard({
  balances,
  accounts,
}: {
  balances: AccountBalance[]
  accounts: Account[]
}) {
  const visibleBalances = balances.filter((b) => !b.is_hidden)

  const totalARS = visibleBalances
    .filter((b) => b.currency === "ARS")
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  const totalUSD = visibleBalances
    .filter((b) => b.currency === "USD")
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)

  const totalAccountsCount = accounts.length

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Patrimonio total
        </p>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
          {totalAccountsCount} {totalAccountsCount === 1 ? "cuenta" : "cuentas"}
        </span>
      </div>

      {/* Grand total approximation (ARS) */}
      <p
        className="text-3xl font-bold tabular-nums text-foreground leading-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {formatCurrency(totalARS, "ARS")}
      </p>

      {/* Sub-totals */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="tabular-nums">
          ARS {formatCurrency(totalARS, "ARS")}
        </span>
        {totalUSD > 0 && (
          <>
            <span>·</span>
            <span className="tabular-nums text-accent font-semibold">
              {totalUSD > 0 ? "+" : ""}
              {formatCurrency(totalUSD, "USD")}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export function AccountsList() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: balances = [] } = useQuery({
    queryKey: BALANCES_KEY,
    queryFn: fetchBalances,
  })

  const [userId, setUserId] = useState<string | undefined>(undefined)
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const balanceMap = new Map(balances.map((b) => [b.account_id, b]))

  const visible = accounts?.filter((a) => !a.is_hidden) ?? []
  const hidden = accounts?.filter((a) => a.is_hidden) ?? []

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cuentas
        </h1>
        <CreateAccountDialog asIconButton userId={userId} />
      </div>

      {/* Patrimonio hero */}
      {!loadingAccounts && accounts && accounts.length > 0 && (
        <PatrimonioCard balances={balances} accounts={accounts} />
      )}

      {/* Loading */}
      {loadingAccounts && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <AccountCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingAccounts && accounts?.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No tenés cuentas todavía
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Agregá tu primera cuenta bancaria, billetera o efectivo para empezar.
            </p>
          </div>
          <CreateAccountDialog userId={userId} />
        </div>
      )}

      {/* Visible accounts */}
      {!loadingAccounts && visible.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
            Mis cuentas
          </p>
          <div className="space-y-2">
            {visible.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                balance={balanceMap.get(account.id) ?? undefined}
                userId={userId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hidden accounts */}
      {!loadingAccounts && hidden.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
            Cuentas ocultas
          </p>
          <div className="space-y-2">
            {hidden.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                balance={balanceMap.get(account.id) ?? undefined}
                userId={userId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add account dashed button */}
      {!loadingAccounts && accounts && accounts.length > 0 && (
        <CreateAccountDialog userId={userId} />
      )}
    </div>
  )
}
