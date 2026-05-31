"use client"

import { useState, useCallback, useMemo, useTransition } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  X,
  SlidersHorizontal,
  Clock,
} from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MovementForm, movementToFormValues, type MovementFormValues } from "./movement-form"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  ACCOUNTS_KEY,
  BALANCES_KEY,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/movements"
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"

type Movement = Tables<"movements">
type Category = Tables<"categories">

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)
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

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return "Hoy"
  if (isYesterday(date)) return "Ayer"
  return format(date, "EEE d MMM", { locale: es })
}

// ── Movement row ──────────────────────────────────────────────────────────────

function MovementRow({
  movement,
  account,
  category,
  onEdit,
  onDelete,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  onEdit: (m: Movement) => void
  onDelete: (m: Movement) => void
}) {
  const isIncome = movement.type === "income"
  const displayAmount = movement.converted_amount ?? movement.amount
  const displayCurrency = account?.currency ?? movement.original_currency
  const isCross = movement.converted_amount !== null

  return (
    <div className="flex items-center gap-3 py-3 group">
      {/* Icon */}
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-medium truncate">
            {category?.name ?? "Sin categoría"}
          </p>
          {movement.is_future && (
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-medium">
            {account?.name ?? "—"}
          </span>
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-3.5 font-medium border-border/60 text-muted-foreground uppercase"
          >
            {displayCurrency}
          </Badge>
          {movement.note && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              · {movement.note}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0 mr-1">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isIncome ? "text-success" : "text-destructive"
          )}
        >
          {isIncome ? "+" : "−"}
          {formatCurrency(displayAmount, displayCurrency)}
        </p>
        {isCross && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatCurrency(movement.amount, movement.original_currency)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Editar"
          className="press-effect cursor-pointer"
          onClick={() => onEdit(movement)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Eliminar"
          className="press-effect cursor-pointer"
          onClick={() => onDelete(movement)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ── Filters panel ─────────────────────────────────────────────────────────────

function FiltersPanel({
  accounts,
  categories,
  onClose,
}: {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams]
  )

  const typeValue = searchParams.get("type") ?? "all"
  const accountValue = searchParams.get("account") ?? "all"
  const categoryValue = searchParams.get("category") ?? "all"
  const dateFrom = searchParams.get("from") ?? ""
  const dateTo = searchParams.get("to") ?? ""
  const searchValue = searchParams.get("q") ?? ""

  const hasFilters =
    typeValue !== "all" ||
    accountValue !== "all" ||
    categoryValue !== "all" ||
    dateFrom ||
    dateTo ||
    searchValue

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Filtros</p>
        </div>
        <div className="flex items-center gap-1">
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  router.push(pathname, { scroll: false })
                })
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={typeValue}
            onValueChange={(v) => updateParam("type", v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Ingresos</SelectItem>
              <SelectItem value="expense">Gastos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Account */}
        <div className="space-y-1.5">
          <Label className="text-xs">Cuenta</Label>
          <Select
            value={accountValue}
            onValueChange={(v) => updateParam("account", v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs">Categoría</Label>
          <Select
            value={categoryValue}
            onValueChange={(v) => updateParam("category", v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date from */}
        <div className="space-y-1.5">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => updateParam("from", e.target.value || null)}
            className="text-xs"
          />
        </div>

        {/* Date to */}
        <div className="space-y-1.5">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => updateParam("to", e.target.value || null)}
            className="text-xs"
          />
        </div>

        {/* Search */}
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label className="text-xs">Buscar en nota</Label>
          <Input
            type="text"
            placeholder="Buscar…"
            value={searchValue}
            onChange={(e) => updateParam("q", e.target.value || null)}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateMovementDialog({
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const account = accounts.find((a) => a.id === values.account_id)
      const isCross =
        account && values.original_currency !== account.currency

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

  if (!accounts.length) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 font-semibold press-effect">
            <PlusCircle className="h-4 w-4" />
            Nuevo
          </Button>
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
          onSubmit={async (v) => {
            await mutation.mutateAsync(v)
          }}
          isLoading={mutation.isPending}
          submitLabel="Crear movimiento"
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditMovementDialog({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  movement: Movement
  accounts: Account[]
  categories: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: MovementFormValues) => {
      const supabase = createClient()
      const account = accounts.find((a) => a.id === values.account_id)
      const isCross =
        account && values.original_currency !== account.currency

      const { data, error } = await supabase
        .from("movements")
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", movement.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: MOVEMENTS_KEY })
      const previous = queryClient.getQueryData<Movement[]>(MOVEMENTS_KEY)
      queryClient.setQueryData<Movement[]>(MOVEMENTS_KEY, (old = []) =>
        old.map((m) =>
          m.id === movement.id
            ? {
                ...m,
                type: values.type,
                amount: values.amount,
                original_currency: values.original_currency,
                account_id: values.account_id,
                category_id: values.category_id,
                date: values.date,
                note: values.note || null,
                is_future: values.is_future,
              }
            : m
        )
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(MOVEMENTS_KEY, context.previous)
      }
      toast.error("Error al actualizar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento actualizado")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>Modificá los datos del movimiento.</DialogDescription>
        </DialogHeader>
        <MovementForm
          accounts={accounts}
          categories={categories}
          defaultValues={movementToFormValues(movement)}
          onSubmit={async (v) => {
            await mutation.mutateAsync(v)
          }}
          isLoading={mutation.isPending}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteMovementDialog({
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: MOVEMENTS_KEY })
      const previous = queryClient.getQueryData<Movement[]>(MOVEMENTS_KEY)
      queryClient.setQueryData<Movement[]>(MOVEMENTS_KEY, (old = []) =>
        old.filter((m) => m.id !== movement.id)
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(MOVEMENTS_KEY, context.previous)
      }
      toast.error("Error al eliminar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento eliminado")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar movimiento</DialogTitle>
          <DialogDescription>
            ¿Estás seguro? Esta acción no se puede deshacer.
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
            {mutation.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── FAB ────────────────────────────────────────────────────────────────────────

function FABCreateMovement({
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const account = accounts.find((a) => a.id === values.account_id)
      const isCross =
        account && values.original_currency !== account.currency

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] right-4 z-30",
          "w-14 h-14 rounded-full bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/35 press-effect",
          "flex items-center justify-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        aria-label="Nuevo movimiento"
      >
        <PlusCircle className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
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
            onSubmit={async (v) => {
              await mutation.mutateAsync(v)
            }}
            isLoading={mutation.isPending}
            submitLabel="Crear movimiento"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MovementsList() {
  const searchParams = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null)

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: MOVEMENTS_KEY,
    queryFn: fetchMovements,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  // ── Apply filters from URL params ─────────────────────────────────────────
  const filteredMovements = useMemo(() => {
    if (!movements) return []

    const typeFilter = searchParams.get("type")
    const accountFilter = searchParams.get("account")
    const categoryFilter = searchParams.get("category")
    const fromFilter = searchParams.get("from")
    const toFilter = searchParams.get("to")
    const searchFilter = searchParams.get("q")?.toLowerCase()

    return movements.filter((m) => {
      if (typeFilter && m.type !== typeFilter) return false
      if (accountFilter && m.account_id !== accountFilter) return false
      if (categoryFilter && m.category_id !== categoryFilter) return false
      if (fromFilter && m.date < fromFilter) return false
      if (toFilter && m.date > toFilter) return false
      if (searchFilter && !(m.note ?? "").toLowerCase().includes(searchFilter)) return false
      return true
    })
  }, [movements, searchParams])

  // ── Group by date ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, Movement[]>()
    for (const m of filteredMovements) {
      const day = startOfDay(parseISO(m.date)).toISOString()
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(m)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredMovements])

  const hasActiveFilters =
    searchParams.get("type") ||
    searchParams.get("account") ||
    searchParams.get("category") ||
    searchParams.get("from") ||
    searchParams.get("to") ||
    searchParams.get("q")

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div className="space-y-0.5">
          <h1
            className="text-2xl md:text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Movimientos
          </h1>
          <p className="text-sm text-muted-foreground">
            Registrá ingresos y gastos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 cursor-pointer press-effect",
              hasActiveFilters && "border-primary/40 text-primary"
            )}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
          <div className="hidden lg:block">
            <CreateMovementDialog accounts={accounts} categories={categories} />
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <FiltersPanel
          accounts={accounts}
          categories={categories}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Loading skeleton */}
      {loadingMovements && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              {[...Array(2)].map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingMovements && filteredMovements.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <ArrowDownCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {hasActiveFilters
                ? "Sin resultados"
                : "Registrá tu primer movimiento"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {hasActiveFilters
                ? "Intentá con otros filtros o limpiá la búsqueda."
                : "Agregá un ingreso o gasto para empezar a trackear tus finanzas."}
            </p>
          </div>
          {!hasActiveFilters && accounts.length > 0 && (
            <CreateMovementDialog accounts={accounts} categories={categories} />
          )}
        </div>
      )}

      {/* Grouped movements */}
      {!loadingMovements && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(([dayKey, dayMovements]) => {
            const dayStr = dayMovements[0].date
            return (
              <div key={dayKey}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                  {formatDayLabel(dayStr)}
                </p>
                <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
                  {dayMovements.map((m, idx) => (
                    <div key={m.id} className="px-4">
                      <MovementRow
                        movement={m}
                        account={accountMap.get(m.account_id)}
                        category={m.category_id ? categoryMap.get(m.category_id) : undefined}
                        onEdit={setEditingMovement}
                        onDelete={setDeletingMovement}
                      />
                      {idx < dayMovements.length - 1 && (
                        <Separator className="opacity-40" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more hint when exactly 100 results */}
      {!loadingMovements && filteredMovements.length === 100 && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          Mostrando los últimos 100 movimientos. Usá los filtros de fecha para ver más.
        </p>
      )}

      {/* Mobile FAB */}
      {accounts.length > 0 && (
        <FABCreateMovement accounts={accounts} categories={categories} />
      )}

      {/* Edit dialog */}
      {editingMovement && (
        <EditMovementDialog
          movement={editingMovement}
          accounts={accounts}
          categories={categories}
          open={!!editingMovement}
          onOpenChange={(v) => { if (!v) setEditingMovement(null) }}
        />
      )}

      {/* Delete dialog */}
      {deletingMovement && (
        <DeleteMovementDialog
          movement={deletingMovement}
          open={!!deletingMovement}
          onOpenChange={(v) => { if (!v) setDeletingMovement(null) }}
        />
      )}
    </div>
  )
}
