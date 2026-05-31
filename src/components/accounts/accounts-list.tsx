"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusCircle, Pencil, Trash2, EyeOff, Landmark, Briefcase } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AccountForm, accountToFormValues, type AccountFormValues } from "./account-form"
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ICON_COMPONENTS,
  type Account,
  type AccountBalance,
  type AccountType,
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

// ── Account icon component ────────────────────────────────────
function AccountTypeIcon({ type, className }: { type: AccountType; className?: string }) {
  const Icon = ACCOUNT_TYPE_ICON_COMPONENTS[type] ?? Briefcase
  return <Icon className={cn("h-5 w-5", className)} />
}

// ── Sub-components ────────────────────────────────────────────

function AccountCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────
function CreateAccountDialog() {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2 font-semibold press-effect">
          <PlusCircle className="h-4 w-4" />
          Nueva cuenta
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
          <DialogDescription>
            Completá los datos para agregar una cuenta a tu perfil.
          </DialogDescription>
        </DialogHeader>
        <AccountForm
          onSubmit={async (values) => { await mutation.mutateAsync(values) }}
          isLoading={mutation.isPending}
          submitLabel="Crear cuenta"
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Edit dialog ───────────────────────────────────────────────
function EditAccountDialog({ account }: { account: Account }) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon-sm" title="Editar cuenta" className="press-effect">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
          <DialogDescription>
            Modificá los datos de la cuenta.
          </DialogDescription>
        </DialogHeader>
        <AccountForm
          defaultValues={accountToFormValues(account)}
          onSubmit={async (values) => { await mutation.mutateAsync(values) }}
          isLoading={mutation.isPending}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
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
        <Button variant="ghost" size="icon-sm" title="Eliminar cuenta" className="press-effect">
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
}: {
  account: Account
  balance: AccountBalance | undefined
}) {
  const currentBalance = balance?.current_balance ?? account.initial_balance

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center gap-3",
        "hover:border-primary/20 hover:shadow-sm transition-all duration-150",
        account.is_hidden && "opacity-60"
      )}
    >
      {/* Icon — use custom if set, otherwise type icon */}
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: account.color
            ? account.color + "22"
            : "var(--muted)",
        }}
      >
        {account.icon && account.icon !== ACCOUNT_TYPE_ICON_FALLBACK(account.type) ? (
          <span className="text-xl leading-none">{account.icon}</span>
        ) : (
          <AccountTypeIcon
            type={account.type}
            className="h-5 w-5"
          />
        )}
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
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-medium border-border/60 text-muted-foreground"
          >
            {ACCOUNT_TYPE_LABELS[account.type]}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-medium uppercase">
            {account.currency}
          </span>
        </div>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0 mr-1">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            currentBalance < 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {formatCurrency(currentBalance, account.currency)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-0.5 flex-shrink-0">
        <EditAccountDialog account={account} />
        <DeleteAccountDialog account={account} />
      </div>
    </div>
  )
}

/** Returns the default emoji for the account type — used to detect "no custom icon" */
function ACCOUNT_TYPE_ICON_FALLBACK(type: AccountType): string {
  const MAP: Record<AccountType, string> = {
    caja_ahorro: "🏦",
    cuenta_corriente: "🏛️",
    efectivo: "💵",
    inversion: "📈",
    tarjeta_credito: "💳",
    billetera_virtual: "📱",
    otro: "💼",
  }
  return MAP[type]
}

// ── Main component ─────────────────────────────────────────────
export function AccountsList() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: balances } = useQuery({
    queryKey: BALANCES_KEY,
    queryFn: fetchBalances,
  })

  const balanceMap = new Map(balances?.map((b) => [b.account_id, b]))

  const visible = accounts?.filter((a) => !a.is_hidden) ?? []
  const hidden = accounts?.filter((a) => a.is_hidden) ?? []

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div className="space-y-0.5">
          <h1
            className="text-2xl md:text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Cuentas
          </h1>
          <p className="text-sm text-muted-foreground">
            Administrá tus cuentas y billeteras
          </p>
        </div>
        <CreateAccountDialog />
      </div>

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
            <Landmark className="h-8 w-8 text-primary" />
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
          <CreateAccountDialog />
        </div>
      )}

      {/* Visible accounts */}
      {!loadingAccounts && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={balanceMap.get(account.id) ?? undefined}
            />
          ))}
        </div>
      )}

      {/* Hidden accounts */}
      {!loadingAccounts && hidden.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Cuentas ocultas
          </p>
          {hidden.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={balanceMap.get(account.id) ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
