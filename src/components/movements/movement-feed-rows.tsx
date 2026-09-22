import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Clock, Pencil, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import { cn, formatCurrency } from "@/lib/utils"

type Movement = Tables<"movements">
type Transfer = Tables<"transfers">
type Category = Tables<"categories">

// ── Date chip (day/month, shown on every row) ─────────────────────────────────

export function RowDateChip({ date }: { date: string }) {
  const d = parseISO(date)
  return (
    <div className="flex flex-col items-center justify-center w-8 md:w-9 flex-shrink-0 leading-none">
      <span className="text-[9px] md:text-[10px] font-semibold text-muted-foreground uppercase">
        {format(d, "MMM", { locale: es })}
      </span>
      <span className="text-sm md:text-base font-bold tabular-nums">
        {format(d, "d")}
      </span>
    </div>
  )
}

// ── Movement row ──────────────────────────────────────────────────────────────

export const MAX_ROW_TAGS = 3

export function MovementRow({
  movement,
  account,
  category,
  onEdit,
  onDelete,
  onOpenDetail,
  onTagClick,
  selectionMode,
  isSelected,
  onToggle,
  isDemo,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  onEdit: (m: Movement) => void
  onDelete: (m: Movement) => void
  onOpenDetail?: (m: Movement) => void
  onTagClick?: (tag: string) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  isDemo?: boolean
}) {
  const isIncome = movement.type === "income"
  const displayAmount = movement.converted_amount ?? movement.amount
  const displayCurrency = account?.currency ?? movement.original_currency
  const isCross = movement.converted_amount !== null
  const isCuota = movement.installment_purchase_id !== null

  return (
    <div
      onClick={selectionMode ? () => onToggle?.(movement.id) : () => onOpenDetail?.(movement)}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-center gap-3 py-3 group",
        "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(movement.id)}
        />
      ) : (
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
            isIncome ? "bg-success/10" : "bg-destructive/10"
          )}
        >
          {isIncome ? (
            <ArrowUpCircle className="h-4.5 w-4.5 text-success" style={{ width: "1.125rem", height: "1.125rem" }} />
          ) : (
            <ArrowDownCircle className="h-4.5 w-4.5 text-destructive" style={{ width: "1.125rem", height: "1.125rem" }} />
          )}
        </div>
      )}

      <RowDateChip date={movement.date} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap min-w-0">
          <p className="text-sm font-medium truncate">
            {category?.name ?? "Sin categoría"}
          </p>
          {movement.is_future && (
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          {isCuota && movement.installment_number !== null && movement.installment_total !== null && (
            <Link
              href={`/cuotas/${movement.installment_purchase_id}`}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0 rounded-md text-[10px] font-bold flex-shrink-0",
                "bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              Cuota {movement.installment_number}/{movement.installment_total}
            </Link>
          )}
        </div>
        <p className="text-[11px] md:text-xs text-muted-foreground truncate">
          <span className="md:text-foreground/70">{account?.name ?? "—"}</span>
          {movement.note ? (
            <>
              <span className="mx-1">·</span>
              <span className="md:text-foreground/90 md:font-medium">{movement.note}</span>
            </>
          ) : null}
        </p>
        {movement.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {movement.tags.slice(0, MAX_ROW_TAGS).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn("h-4 text-[10px] px-1.5", onTagClick && "cursor-pointer hover:bg-muted")}
                onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(tag) } : undefined}
              >
                {tag}
              </Badge>
            ))}
            {movement.tags.length > MAX_ROW_TAGS && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{movement.tags.length - MAX_ROW_TAGS}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isIncome ? "text-success" : "text-destructive"
          )}
        >
          {isIncome ? "+ " : "− "}
          {formatCurrency(displayAmount, displayCurrency)}
        </p>
        {isCross && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatCurrency(movement.amount, movement.original_currency)}
          </p>
        )}
      </div>

      {/* Actions — visible on hover, hidden in selection mode */}
      {!selectionMode && (
        <div className="hidden lg:flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Editar"}
            className="press-effect cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onEdit(movement) }}
            disabled={isDemo}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Eliminar"}
            className="press-effect cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onDelete(movement) }}
            disabled={isDemo}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Transfer row ──────────────────────────────────────────────────────────────

export function TransferRow({
  transfer,
  fromAccount,
  toAccount,
  onEdit,
  onDelete,
  onOpenDetail,
  selectionMode,
  isSelected,
  onToggle,
  isDemo,
}: {
  transfer: Transfer
  fromAccount: Account | undefined
  toAccount: Account | undefined
  onEdit: (t: Transfer) => void
  onDelete: (t: Transfer) => void
  onOpenDetail?: (t: Transfer) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  isDemo?: boolean
}) {
  const isCross =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  // Transfers use a "t-{id}" prefix in the selection set to avoid collisions
  const selectionId = `t-${transfer.id}`

  return (
    <div
      onClick={selectionMode ? () => onToggle?.(selectionId) : () => onOpenDetail?.(transfer)}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-center gap-3 py-3 group",
        "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(selectionId)}
        />
      ) : (
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <RowDateChip date={transfer.date} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-medium truncate">
            Transferencia
          </p>
          {transfer.is_future && (
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <p className="text-[11px] md:text-xs text-muted-foreground truncate">
          <span className="md:text-foreground/70">{fromAccount?.name ?? "—"} → {toAccount?.name ?? "—"}</span>
          {transfer.note ? (
            <>
              <span className="mx-1">·</span>
              <span className="md:text-foreground/90 md:font-medium">{transfer.note}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* Amounts */}
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="text-sm font-semibold tabular-nums text-muted-foreground">
          −{formatCurrency(transfer.from_amount, fromAccount?.currency ?? "ARS")}
        </p>
        {isCross && (
          <p className="text-[10px] tabular-nums text-muted-foreground">
            +{formatCurrency(transfer.to_amount, toAccount?.currency ?? "ARS")}
          </p>
        )}
      </div>

      {/* Actions — hidden in selection mode */}
      {!selectionMode && (
        <div className="hidden lg:flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Editar"}
            className="press-effect cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onEdit(transfer) }}
            disabled={isDemo}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Eliminar"}
            className="press-effect cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onDelete(transfer) }}
            disabled={isDemo}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  )
}
