"use client"

import { useState, useMemo, useSyncExternalStore } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowDownCircle,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Hash,
  Divide,
  type LucideIcon,
} from "lucide-react"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton } from "@/components/ui/selection-bar"
import { bulkDelete } from "@/lib/bulk-delete"
import { Button } from "@/components/ui/button"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { defaultDateRange } from "@/components/ui/date-range-filter"
import { MovementDetailSheet, TransferDetailSheet } from "./movement-detail-sheets"
import { MovementRow, TransferRow } from "./movement-feed-rows"
import { MovementsFilterBar, type GroupBy } from "./movements-filter-bar"
import { DeleteMovementDialog } from "./movement-delete-dialog"
import { EditTransferDialog, DeleteTransferDialog } from "./transfer-dialogs"
import { formatCurrency, cn } from "@/lib/utils"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  TRANSFERS_KEY,
  ACCOUNTS_KEY,
  BALANCES_KEY,
  fetchMovements,
  fetchTransfers,
  filterKey,
  type MovementsFilter,
} from "@/lib/movements"
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"
import { summaryTotals } from "@/lib/stats"
import { QuickAddMenu } from "./quick-add-menu"
import { EditMovementDialog } from "./edit-movement-dialog"
import { useIsDemo } from "@/lib/use-is-demo"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { QueryError } from "@/components/ui/query-error"

type Movement = Tables<"movements">
type Transfer = Tables<"transfers">

const FETCH_LIMIT = 200

// Discriminated union for unified feed
type FeedItem =
  | { kind: "movement"; item: Movement }
  | { kind: "transfer"; item: Transfer }

// ── Default filter ────────────────────────────────────────────────────────────

function defaultFilter(): MovementsFilter {
  return {
    search: "",
    type: "all",
    date: defaultDateRange(),
    accountIds: [],
    categoryIds: [],
    sortField: "date",
    sortDir: "desc",
  }
}

/** Amount used to compare FeedItems for "sort by amount" — movements use `amount`, transfers use `from_amount`. */
function feedItemAmount(fi: FeedItem): number {
  return fi.kind === "movement" ? fi.item.amount : fi.item.from_amount
}

/** Comparator for FeedItems honoring the active sort field/direction, with created_at as tie-break. */
function makeFeedComparator(sortField: MovementsFilter["sortField"], sortDir: MovementsFilter["sortDir"]) {
  const dirMul = sortDir === "asc" ? 1 : -1
  return (a: FeedItem, b: FeedItem) => {
    if (sortField === "amount") {
      const diff = feedItemAmount(a) - feedItemAmount(b)
      if (diff !== 0) return diff * dirMul
    } else {
      const dateDiff = a.item.date.localeCompare(b.item.date)
      if (dateDiff !== 0) return dateDiff * dirMul
    }
    return a.item.created_at.localeCompare(b.item.created_at) * dirMul
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return "Hoy"
  if (isYesterday(date)) return "Ayer"
  return format(date, "EEE d MMM", { locale: es })
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function SummaryStat({
  icon: Icon,
  iconClassName,
  label,
  dateLabel,
  value,
  valueClassName,
}: {
  icon: LucideIcon
  iconClassName?: string
  label: string
  dateLabel: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center justify-between gap-3 sm:block sm:space-y-1.5">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-4 w-4 flex-shrink-0", iconClassName)} aria-hidden />
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        </div>
        <p className="text-[10px] text-muted-foreground/70 leading-none">{dateLabel}</p>
      </div>
      <p className={cn("text-base font-bold tabular-nums leading-tight shrink-0", valueClassName)}>{value}</p>
    </div>
  )
}

// ── Edit movement dialog compatibility export ───────────────────────────────

export { EditMovementDialog }

// ── Main component ─────────────────────────────────────────────────────────────

export function MovementsList() {
  const isDemo = useIsDemo()
  const [filter, setFilter] = useState<MovementsFilter>(defaultFilter)
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null)
  const [detailMovement, setDetailMovement] = useState<Movement | null>(null)
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const queryClient = useQueryClient()

  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useAccounts()

  const { data: categories = [] } = useCategories()

  // Derive the stable filter key once so both queries share it
  const fKey = filterKey(filter)

  const {
    data: movements,
    isLoading: loadingMovements,
    isError: movementsError,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: [...MOVEMENTS_KEY, fKey],
    queryFn: () => fetchMovements(filter, accounts, categories),
    enabled: accounts.length > 0, // wait for lookups to be loaded
  })

  const {
    data: transfers,
    isLoading: loadingTransfers,
    isError: transfersError,
    refetch: refetchTransfers,
  } = useQuery({
    queryKey: [...TRANSFERS_KEY, fKey],
    queryFn: () => fetchTransfers(filter, accounts),
    enabled: accounts.length > 0,
  })

  const feedError = accountsError || movementsError || transfersError
  const retryFeed = () => {
    if (accountsError) refetchAccounts()
    refetchMovements()
    refetchTransfers()
  }

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  const isLoading = loadingMovements || loadingTransfers

  // ── Build unified feed ─────────────────────────────────────────────────────
  const feed = useMemo<FeedItem[]>(() => {
    const movementItems: FeedItem[] = (movements ?? []).map((item) => ({ kind: "movement", item }) as FeedItem)
    const transferItems: FeedItem[] = (transfers ?? []).map((item) => ({ kind: "transfer", item }) as FeedItem)
    return [...movementItems, ...transferItems]
  }, [movements, transfers])

  // ── Totals for summary cards ───────────────────────────────────────────────
  const totals = useMemo(
    () => summaryTotals(movements ?? [], "ARS"),
    [movements]
  )

  const incomeCount = useMemo(
    () => (movements ?? []).filter((m) => m.type === "income").length,
    [movements]
  )
  const expenseCount = useMemo(
    () => (movements ?? []).filter((m) => m.type === "expense").length,
    [movements]
  )
  const avgIncome = incomeCount ? totals.income / incomeCount : 0
  const avgExpense = expenseCount ? totals.expense / expenseCount : 0
  const transferCount = transfers?.length ?? 0
  const transferTotal = useMemo(
    () => (transfers ?? []).reduce((acc, t) => acc + t.from_amount, 0),
    [transfers]
  )

  // ── Build grouped feed parametrized by groupBy ───────────────────────────
  const groupedFeed = useMemo<{ key: string; label: string; items: FeedItem[] }[]>(() => {
    const cmp = makeFeedComparator(filter.sortField, filter.sortDir)
    // Group order for day/month follows sortDir: desc = newest group first (previous default), asc = oldest first
    const groupDirMul = filter.sortDir === "asc" ? 1 : -1

    if (groupBy === "none") {
      // Flat list — sorted by the active sort field/direction; single pseudo-group with no label
      const sorted = [...feed].sort(cmp)
      return sorted.length > 0 ? [{ key: "__flat__", label: "", items: sorted }] : []
    }

    if (groupBy === "day") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        const day = startOfDay(parseISO(fi.item.date)).toISOString()
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]) * groupDirMul)
        .map(([key, items]) => ({
          key,
          label: formatDayLabel(items[0].item.date),
          items: [...items].sort(cmp),
        }))
    }

    if (groupBy === "month") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        const d = parseISO(fi.item.date)
        const monthKey = format(d, "yyyy-MM")
        if (!map.has(monthKey)) map.set(monthKey, [])
        map.get(monthKey)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]) * groupDirMul)
        .map(([key, items]) => {
          const d = parseISO(key + "-01")
          const label = format(d, "MMMM yyyy", { locale: es })
          return { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [...items].sort(cmp) }
        })
    }

    if (groupBy === "category") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        let key: string
        if (fi.kind === "transfer") {
          key = "__transfer__"
        } else {
          key = fi.item.category_id ?? "__none__"
        }
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, items]) => {
          let label: string
          if (key === "__transfer__") label = "Transferencias"
          else if (key === "__none__") label = "Sin categoría"
          else label = categoryMap.get(key)?.name ?? "Sin categoría"
          return { key, label, items: [...items].sort(cmp) }
        })
    }

    if (groupBy === "account") {
      const map = new Map<string, FeedItem[]>()
      for (const fi of feed) {
        let key: string
        if (fi.kind === "transfer") {
          key = "__transfer__"
        } else {
          key = fi.item.account_id
        }
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(fi)
      }
      return [...map.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, items]) => {
          let label: string
          if (key === "__transfer__") label = "Transferencias"
          else label = accountMap.get(key)?.name ?? "—"
          return { key, label, items: [...items].sort(cmp) }
        })
    }

    return []
  }, [feed, groupBy, accountMap, categoryMap, filter.sortField, filter.sortDir])

  const totalItems = feed.length

  const hasActiveFilters =
    filter.type !== "all" ||
    filter.date.preset !== "all_time" ||
    filter.date.from !== null ||
    filter.date.to !== null ||
    filter.accountIds.length > 0 ||
    filter.categoryIds.length > 0 ||
    filter.search !== ""

  // Feed item IDs for "select all"
  const feedItemIds = useMemo(
    () => feed.map((fi) => (fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`)),
    [feed]
  )

  // Whether results are at the limit (suggesting truncation)
  const movementsAtLimit = (movements?.length ?? 0) >= FETCH_LIMIT
  const transfersAtLimit = (transfers?.length ?? 0) >= FETCH_LIMIT

  async function handleBulkDelete() {
    setBulkPending(true)
    const selected = Array.from(ms.selectedIds)
    const movementIds = selected.filter((id) => !id.startsWith("t-"))
    const transferIds = selected.filter((id) => id.startsWith("t-")).map((id) => id.slice(2))

    let deletedCount = 0
    let failedCount = 0

    if (movementIds.length > 0) {
      const res = await bulkDelete("movements", movementIds)
      deletedCount += res.deleted
      failedCount += res.failed
    }
    if (transferIds.length > 0) {
      const res = await bulkDelete("transfers", transferIds)
      deletedCount += res.deleted
      failedCount += res.failed
    }

    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
    queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
    queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })

    if (failedCount === 0) {
      toast.success(`Se eliminaron ${deletedCount} elemento${deletedCount !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${deletedCount}. ${failedCount} no se pud${failedCount !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Movimientos
        </h1>
        <div className="flex items-center gap-2">
          {hydrated && !isLoading && totalItems > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
          <div className="hidden lg:block">{hydrated && <QuickAddMenu accounts={accounts} />}</div>
        </div>
      </div>

      {/* Filter bar — always visible */}
      <MovementsFilterBar
        filter={filter}
        onChange={setFilter}
        accounts={accounts}
        categories={categories}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        defaultFilter={defaultFilter}
        isDemo={isDemo}
      />

      {/* Adaptive summary cards */}
      {hydrated && !isLoading && totalItems > 0 && (
        <div className="space-y-2">
          {filter.type === "all" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryStat icon={TrendingUp} iconClassName="text-success" label="Ingresos" dateLabel={filter.date.label} value={`+${formatCurrency(totals.income, "ARS")}`} valueClassName="text-success" />
              <SummaryStat icon={TrendingDown} iconClassName="text-destructive" label="Gastos" dateLabel={filter.date.label} value={`−${formatCurrency(totals.expense, "ARS")}`} valueClassName="text-destructive" />
              <SummaryStat icon={Scale} iconClassName="text-muted-foreground" label="Balance" dateLabel={filter.date.label} value={`${totals.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(totals.net), "ARS")}`} valueClassName={totals.net >= 0 ? "text-success" : "text-destructive"} />
            </div>
          )}

          {filter.type === "income" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryStat icon={TrendingUp} iconClassName="text-success" label="Total ingresos" dateLabel={filter.date.label} value={`+${formatCurrency(totals.income, "ARS")}`} valueClassName="text-success" />
              <SummaryStat icon={Hash} iconClassName="text-muted-foreground" label="Cantidad" dateLabel={filter.date.label} value={incomeCount} valueClassName="text-foreground" />
              <SummaryStat icon={Divide} iconClassName="text-muted-foreground" label="Promedio" dateLabel={filter.date.label} value={formatCurrency(avgIncome, "ARS")} valueClassName="text-foreground" />
            </div>
          )}

          {filter.type === "expense" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryStat icon={TrendingDown} iconClassName="text-destructive" label="Total gastos" dateLabel={filter.date.label} value={`−${formatCurrency(totals.expense, "ARS")}`} valueClassName="text-destructive" />
              <SummaryStat icon={Hash} iconClassName="text-muted-foreground" label="Cantidad" dateLabel={filter.date.label} value={expenseCount} valueClassName="text-foreground" />
              <SummaryStat icon={Divide} iconClassName="text-muted-foreground" label="Promedio" dateLabel={filter.date.label} value={formatCurrency(avgExpense, "ARS")} valueClassName="text-foreground" />
            </div>
          )}

          {filter.type === "transfer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryStat icon={ArrowLeftRight} iconClassName="text-muted-foreground" label="Transferencias" dateLabel={filter.date.label} value={transferCount} valueClassName="text-foreground" />
              <SummaryStat icon={TrendingUp} iconClassName="text-muted-foreground" label="Total movido" dateLabel={filter.date.label} value={formatCurrency(transferTotal, "ARS")} valueClassName="text-foreground" />
            </div>
          )}

          {filter.type !== "transfer" && (
            <p className="text-xs text-muted-foreground px-1">
              {totalItems} {totalItems === 1 ? "movimiento" : "movimientos"}
            </p>
          )}
        </div>
      )}
      {(!hydrated || isLoading) && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[64px] sm:h-[76px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      )}

      {/* Loading skeleton */}
      {(!hydrated || isLoading) && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                    <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {hydrated && !isLoading && feedError && (
        <QueryError onRetry={retryFeed} />
      )}

      {/* Empty state */}
      {hydrated && !isLoading && !feedError && totalItems === 0 && (
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
                : "Agregá un ingreso, gasto o transferencia para empezar."}
            </p>
          </div>
        </div>
      )}

      {/* Feed (flat or grouped) */}
      {hydrated && !isLoading && groupedFeed.length > 0 && (
        <div className="space-y-5">
          {groupedFeed.map(({ key, label, items }) => (
            <div key={key}>
              {/* Group header — hidden in flat mode */}
              {groupBy !== "none" && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  {label}
                </p>
              )}
              {/* Items card */}
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                {items.map((fi) => {
                  const feedId = fi.kind === "movement" ? fi.item.id : `t-${fi.item.id}`
                  return (
                    <div key={feedId} className="px-4">
                      {fi.kind === "movement" ? (
                        <MovementRow
                          movement={fi.item}
                          account={accountMap.get(fi.item.account_id)}
                          category={fi.item.category_id ? categoryMap.get(fi.item.category_id) : undefined}
                          onEdit={setEditingMovement}
                          onDelete={setDeletingMovement}
                          onOpenDetail={setDetailMovement}
                          onTagClick={(tag) => setFilter((f) => ({ ...f, search: tag }))}
                          selectionMode={ms.selectionMode}
                          isSelected={ms.isSelected(fi.item.id)}
                          onToggle={ms.toggle}
                          isDemo={isDemo}
                        />
                      ) : (
                        <TransferRow
                          transfer={fi.item}
                          fromAccount={accountMap.get(fi.item.from_account_id)}
                          toAccount={accountMap.get(fi.item.to_account_id)}
                          onEdit={setEditingTransfer}
                          onDelete={setDeletingTransfer}
                          onOpenDetail={setDetailTransfer}
                          selectionMode={ms.selectionMode}
                          isSelected={ms.isSelected(`t-${fi.item.id}`)}
                          onToggle={ms.toggle}
                          isDemo={isDemo}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more / truncation notice */}
      {hydrated && !isLoading && (movementsAtLimit || transfersAtLimit) && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          Mostrando los primeros {FETCH_LIMIT} registros. Usá los filtros de fecha para ver períodos anteriores.
        </p>
      )}

      {/* Detail sheets */}
      {detailMovement && (
        <MovementDetailSheet
          movement={detailMovement}
          account={accountMap.get(detailMovement.account_id)}
          category={detailMovement.category_id ? categoryMap.get(detailMovement.category_id) : undefined}
          isDemo={isDemo}
          open={!!detailMovement}
          onOpenChange={(v) => { if (!v) setDetailMovement(null) }}
          onEdit={() => { const m = detailMovement; setDetailMovement(null); setEditingMovement(m) }}
          onDelete={() => { const m = detailMovement; setDetailMovement(null); setDeletingMovement(m) }}
        />
      )}
      {detailTransfer && (
        <TransferDetailSheet
          transfer={detailTransfer}
          fromAccount={accountMap.get(detailTransfer.from_account_id)}
          toAccount={accountMap.get(detailTransfer.to_account_id)}
          isDemo={isDemo}
          open={!!detailTransfer}
          onOpenChange={(v) => { if (!v) setDetailTransfer(null) }}
          onEdit={() => { const t = detailTransfer; setDetailTransfer(null); setEditingTransfer(t) }}
          onDelete={() => { const t = detailTransfer; setDetailTransfer(null); setDeletingTransfer(t) }}
        />
      )}

      {/* Edit dialogs */}
      {editingMovement && (
        <EditMovementDialog
          movement={editingMovement}
          accounts={accounts}
          categories={categories}
          open={!!editingMovement}
          onOpenChange={(v) => { if (!v) setEditingMovement(null) }}
        />
      )}
      {editingTransfer && (
        <EditTransferDialog
          transfer={editingTransfer}
          accounts={accounts}
          open={!!editingTransfer}
          onOpenChange={(v) => { if (!v) setEditingTransfer(null) }}
        />
      )}

      {/* Delete dialogs */}
      {deletingMovement && (
        <DeleteMovementDialog
          movement={deletingMovement}
          open={!!deletingMovement}
          onOpenChange={(v) => { if (!v) setDeletingMovement(null) }}
        />
      )}
      {deletingTransfer && (
        <DeleteTransferDialog
          transfer={deletingTransfer}
          open={!!deletingTransfer}
          onOpenChange={(v) => { if (!v) setDeletingTransfer(null) }}
        />
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={feedItemIds.length}
          onSelectAll={() => ms.toggleAll(feedItemIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <MangoSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar elementos"
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
              disabled={bulkPending || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className="press-effect"
            >
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} elemento{ms.count !== 1 ? "s" : ""}? Esta acción no se puede deshacer.
        </p>
      </MangoSheet>
    </div>
  )
}
