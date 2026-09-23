import type { ReactNode } from "react"
import { CheckCircle2, Circle, Clock, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import type { Tables } from "@/lib/database.types"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

type Movement = Tables<"movements">

type CuotaStatus = "pagada" | "proxima" | "futura"

function getCuotaStatus(movement: Movement): CuotaStatus {
  if (!movement.is_future) return "pagada"
  const today = new Date().toISOString().split("T")[0]
  if (movement.date <= today) return "proxima"
  return "futura"
}

const STATUS_LABELS: Record<CuotaStatus, string> = {
  pagada: "Pagada",
  proxima: "Próxima",
  futura: "Futura",
}

const STATUS_COLORS: Record<CuotaStatus, string> = {
  pagada: "bg-success/10 text-success",
  proxima: "bg-accent/10 text-accent",
  futura: "bg-muted text-muted-foreground",
}

const STATUS_ICONS: Record<CuotaStatus, typeof CheckCircle2> = {
  pagada: CheckCircle2,
  proxima: Clock,
  futura: Circle,
}

export function CuotaRow({
  movement,
  currency,
  onDelete,
  selectionMode,
  isSelected,
  onToggle,
  postponeControls,
  isDemo,
}: {
  movement: Movement
  currency: "ARS" | "USD"
  onDelete: (m: Movement) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  postponeControls?: ReactNode
  isDemo?: boolean
}) {
  const status = getCuotaStatus(movement)
  const StatusIcon = STATUS_ICONS[status]
  const displayAmount = movement.converted_amount ?? movement.amount

  return (
    <div
      onClick={selectionMode ? () => onToggle?.(movement.id) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-center gap-3 py-3 group px-4",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Status icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(movement.id)}
        />
      ) : (
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", STATUS_COLORS[status].split(" ")[0])}>
          <StatusIcon className={cn("h-4 w-4", STATUS_COLORS[status].split(" ")[1])} />
        </div>
      )}

      {/* Date + cuota number */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium tabular-nums">
          {format(parseISO(movement.date), "d MMM yyyy", { locale: es })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Cuota {movement.installment_number} de {movement.installment_total}
        </p>
      </div>

      {/* Postpone controls */}
      {!selectionMode && postponeControls}

      {/* Status badge */}
      {!postponeControls && (
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", STATUS_COLORS[status])}>
          {STATUS_LABELS[status]}
        </span>
      )}

      {/* Amount */}
      <p className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
        − {formatCurrency(displayAmount, currency)}
      </p>

      {/* Delete action — hidden in selection mode or when postpone controls shown */}
      {!selectionMode && !postponeControls && (
        <button
          type="button"
          title={isDemo ? "No disponible en el modo demo" : "Eliminar cuota"}
          onClick={isDemo ? undefined : () => onDelete(movement)}
          disabled={isDemo}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            "hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
