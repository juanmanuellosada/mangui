"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, EyeOff, Briefcase, ChevronRight, Search, X, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { bulkDelete } from "@/lib/bulk-delete"
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
import { Input } from "@/components/ui/input"
import { MangoSelect, type MangoSelectOption } from "@/components/ui/mango-select"
import { CurrencyChip, CurrencyLogo } from "@/components/ui/currency-chip"
import { AccountForm, accountToFormValues, type AccountFormValues } from "./account-form"
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_EMOJIS,
  renderAccountIcon,
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
function CreateAccountDialog({ userId }: { userId?: string }) {
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
      <Button onClick={() => setOpen(true)} className="gap-2 font-semibold press-effect">
        <Plus className="h-4 w-4" />
        Nueva cuenta
      </Button>
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
  selectionMode,
  isSelected,
  onToggle,
}: {
  account: Account
  balance: AccountBalance | undefined
  userId?: string
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
}) {
  const currentBalance = balance?.current_balance ?? account.initial_balance

  function handleCardClick() {
    if (selectionMode && onToggle) onToggle(account.id)
  }

  return (
    <div
      onClick={selectionMode ? handleCardClick : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "rounded-2xl border border-border/60 bg-card px-4 py-4 flex items-center gap-3",
        "hover:border-primary/20 hover:shadow-sm transition-all duration-150",
        account.is_hidden && "opacity-60",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(account.id)}
          label={`Seleccionar ${account.name}`}
        />
      ) : (
        <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/60 overflow-hidden">
          {renderAccountIcon(account.icon, { size: "h-6 w-6", className: "text-muted-foreground", logoFill: true })}
        </div>
      )}

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
          <CurrencyChip currency={account.currency} size="sm" />
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

      {/* Credit card shortcut — hidden in selection mode */}
      {!selectionMode && account.type === "tarjeta_credito" && (
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

      {/* Actions — hidden in selection mode */}
      {!selectionMode && (
        <div className="flex gap-0.5 flex-shrink-0">
          <EditAccountDialog account={account} userId={userId} />
          <DeleteAccountDialog account={account} />
        </div>
      )}
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

// ── Filter helpers ────────────────────────────────────────────
type TipoFilter = "todas" | AccountType
type MonedaFilter = "todas" | "ARS" | "USD"
type VisibilidadFilter = "todas" | "visibles" | "ocultas"
type SortKey = "recientes" | "nombre" | "saldo"
type SortDir = "asc" | "desc"

interface AccountFilters {
  search: string
  tipo: TipoFilter
  moneda: MonedaFilter
  visibilidad: VisibilidadFilter
  sortKey: SortKey
  sortDir: SortDir
}

const DEFAULT_FILTERS: AccountFilters = {
  search: "",
  tipo: "todas",
  moneda: "todas",
  visibilidad: "todas",
  sortKey: "recientes",
  sortDir: "desc",
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function isFiltersActive(f: AccountFilters) {
  return (
    f.search.trim() !== "" ||
    f.tipo !== "todas" ||
    f.moneda !== "todas" ||
    f.visibilidad !== "todas" ||
    f.sortKey !== "recientes"
  )
}

// ── Accounts filter bar ───────────────────────────────────────
const TIPO_OPTIONS: MangoSelectOption[] = [
  { value: "todas", label: "Todos los tipos" },
  ...(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(
    ([type, label]) => ({
      value: type,
      label: `${ACCOUNT_TYPE_EMOJIS[type]} ${label}`,
    })
  ),
]

const MONEDA_OPTIONS: MangoSelectOption[] = [
  { value: "todas", label: "Moneda" },
  { value: "ARS", label: "ARS", leading: <CurrencyLogo currency="ARS" /> },
  { value: "USD", label: "USD", leading: <CurrencyLogo currency="USD" /> },
]

const VISIBILIDAD_OPTIONS: MangoSelectOption[] = [
  { value: "todas", label: "Todas" },
  { value: "visibles", label: "Visibles" },
  { value: "ocultas", label: "Ocultas" },
]


interface AccountsFilterBarProps {
  filters: AccountFilters
  onChange: (f: AccountFilters) => void
  resultCount: number
  totalCount: number
}

// ── Sort segmented control ────────────────────────────────────
const SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "recientes", label: "Recientes" },
  { key: "nombre", label: "Nombre" },
  { key: "saldo", label: "Saldo" },
]

function SortControl({
  sortKey,
  sortDir,
  onChange,
}: {
  sortKey: SortKey
  sortDir: SortDir
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  function handleClick(key: SortKey) {
    if (key === sortKey) {
      // Toggle direction on active pill
      onChange(key, sortDir === "asc" ? "desc" : "asc")
    } else {
      // Default direction per key
      const defaultDir: SortDir = key === "saldo" ? "desc" : key === "nombre" ? "asc" : "desc"
      onChange(key, defaultDir)
    }
  }

  return (
    <div
      role="group"
      aria-label="Ordenar por"
      className="flex items-center gap-1 shrink-0"
    >
      {SORT_PILLS.map(({ key, label }) => {
        const isActive = sortKey === key
        const showDir = isActive && key !== "recientes"
        const DirIcon = sortDir === "asc" ? ChevronUp : ChevronDown
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium",
              "border transition-all duration-150 cursor-pointer select-none motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
            )}
          >
            <span>{label}</span>
            {showDir && <DirIcon className="h-3 w-3 shrink-0" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

function AccountsFilterBar({ filters, onChange, resultCount, totalCount }: AccountsFilterBarProps) {
  const active = isFiltersActive(filters)

  return (
    <div className="space-y-2">
      {/* Single row on lg+: search grows, selects + sort stay compact */}
      <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center">
        {/* Search input — grows to fill available space */}
        <div className="relative flex-1 min-w-[160px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-8 h-9 text-sm"
            aria-label="Buscar cuentas"
          />
        </div>

        {/* Tipo */}
        <div className="w-[160px] shrink-0">
          <MangoSelect
            value={filters.tipo}
            onChange={(v) => onChange({ ...filters, tipo: v as TipoFilter })}
            options={TIPO_OPTIONS}
            aria-label="Filtrar por tipo"
          />
        </div>

        {/* Moneda */}
        <div className="w-[108px] shrink-0">
          <MangoSelect
            value={filters.moneda}
            onChange={(v) => onChange({ ...filters, moneda: v as MonedaFilter })}
            options={MONEDA_OPTIONS}
            aria-label="Filtrar por moneda"
          />
        </div>

        {/* Visibilidad */}
        <div className="w-[110px] shrink-0">
          <MangoSelect
            value={filters.visibilidad}
            onChange={(v) => onChange({ ...filters, visibilidad: v as VisibilidadFilter })}
            options={VISIBILIDAD_OPTIONS}
            aria-label="Filtrar por visibilidad"
          />
        </div>

        {/* Sort segmented control */}
        <SortControl
          sortKey={filters.sortKey}
          sortDir={filters.sortDir}
          onChange={(key, dir) => onChange({ ...filters, sortKey: key, sortDir: dir })}
        />
      </div>

      {/* Result count + clear */}
      {active && (
        <div className="flex items-center gap-3 px-0.5">
          <span className="text-xs text-muted-foreground">
            {resultCount === totalCount
              ? `${resultCount} ${resultCount === 1 ? "cuenta" : "cuentas"}`
              : `${resultCount} de ${totalCount} ${totalCount === 1 ? "cuenta" : "cuentas"}`}
          </span>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className={cn(
              "inline-flex items-center gap-1 text-xs text-muted-foreground",
              "hover:text-foreground transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            )}
          >
            <X className="h-3 w-3" aria-hidden />
            Limpiar filtros
          </button>
        </div>
      )}
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

  const [filters, setFilters] = useState<AccountFilters>(DEFAULT_FILTERS)

  // ── Multi-select ────────────────────────────────────────────
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const queryClient = useQueryClient()

  const balanceMap = new Map(balances.map((b) => [b.account_id, b]))

  const filtersActive = isFiltersActive(filters)

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("accounts", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
    queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} cuenta${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(
        `Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar (tienen movimientos).`
      )
    }
  }

  // When filters are active, flatten all accounts into one filtered + sorted list.
  // When idle, keep the original visible / hidden section split.
  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    const q = normalize(filters.search)

    return accounts
      .filter((a) => {
        // Search
        if (q) {
          const nameMatch = normalize(a.name).includes(q)
          const numMatch = a.account_number ? normalize(a.account_number).includes(q) : false
          if (!nameMatch && !numMatch) return false
        }
        // Tipo
        if (filters.tipo !== "todas" && a.type !== filters.tipo) return false
        // Moneda
        if (filters.moneda !== "todas" && a.currency !== filters.moneda) return false
        // Visibilidad
        if (filters.visibilidad === "visibles" && a.is_hidden) return false
        if (filters.visibilidad === "ocultas" && !a.is_hidden) return false
        return true
      })
      .sort((a, b) => {
        switch (filters.sortKey) {
          case "nombre": {
            const cmp = a.name.localeCompare(b.name, "es")
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          case "saldo": {
            const ba = balanceMap.get(a.id)?.current_balance ?? a.initial_balance
            const bb = balanceMap.get(b.id)?.current_balance ?? b.initial_balance
            return filters.sortDir === "asc" ? ba - bb : bb - ba
          }
          case "recientes":
          default: {
            const cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            return filters.sortDir === "asc" ? -cmp : cmp
          }
        }
      })
  }, [accounts, filters, balanceMap])

  const visible = accounts?.filter((a) => !a.is_hidden) ?? []
  const hidden = accounts?.filter((a) => a.is_hidden) ?? []

  // Visible IDs for toggleAll
  const visibleIds = useMemo(() => {
    if (!accounts) return []
    if (filtersActive) return filteredAccounts.map((a) => a.id)
    return accounts.map((a) => a.id)
  }, [accounts, filtersActive, filteredAccounts])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cuentas
        </h1>
        <div className="flex items-center gap-2">
          {!loadingAccounts && accounts && accounts.length > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
          {!ms.selectionMode && <CreateAccountDialog userId={userId} />}
        </div>
      </div>

      {/* Patrimonio hero — always reflects all non-hidden accounts */}
      {!loadingAccounts && accounts && accounts.length > 0 && (
        <PatrimonioCard balances={balances} accounts={accounts} />
      )}

      {/* Search + filter bar — only when there are accounts */}
      {!loadingAccounts && accounts && accounts.length > 0 && (
        <AccountsFilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={filtersActive ? filteredAccounts.length : accounts.length}
          totalCount={accounts.length}
        />
      )}

      {/* Loading */}
      {loadingAccounts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <AccountCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Onboarding empty state — only when user has zero accounts */}
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

      {/* Filtered empty state — user has accounts but none match the current filters */}
      {!loadingAccounts && accounts && accounts.length > 0 && filtersActive && filteredAccounts.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sin resultados</p>
            <p className="text-sm text-muted-foreground">
              No se encontraron cuentas con esos filtros.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Filtered list — shown when any filter/search is active */}
      {!loadingAccounts && filtersActive && filteredAccounts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={balanceMap.get(account.id) ?? undefined}
              userId={userId}
              selectionMode={ms.selectionMode}
              isSelected={ms.isSelected(account.id)}
              onToggle={ms.toggle}
            />
          ))}
        </div>
      )}

      {/* Default sections — visible / hidden split, shown when no filters active */}
      {!loadingAccounts && !filtersActive && (
        <>
          {/* Visible accounts */}
          {visible.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                Mis cuentas
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {visible.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    balance={balanceMap.get(account.id) ?? undefined}
                    userId={userId}
                    selectionMode={ms.selectionMode}
                    isSelected={ms.isSelected(account.id)}
                    onToggle={ms.toggle}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Hidden accounts */}
          {hidden.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                Cuentas ocultas
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {hidden.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    balance={balanceMap.get(account.id) ?? undefined}
                    userId={userId}
                    selectionMode={ms.selectionMode}
                    isSelected={ms.isSelected(account.id)}
                    onToggle={ms.toggle}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={visibleIds.length}
          onSelectAll={() => ms.toggleAll(visibleIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <MangoSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar cuentas"
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
              disabled={bulkPending}
              className="press-effect"
            >
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} cuenta{ms.count !== 1 ? "s" : ""}? Las que tengan movimientos registrados no se podrán eliminar y se te informará el resultado. Esta acción no se puede deshacer.
        </p>
      </MangoSheet>
    </div>
  )
}
