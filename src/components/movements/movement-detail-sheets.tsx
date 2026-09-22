import { Pencil, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MangoSheet } from "@/components/ui/mango-sheet"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import { formatCurrency, cn } from "@/lib/utils"

type Movement = Tables<"movements">
type Transfer = Tables<"transfers">
type Category = Tables<"categories">

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right min-w-0 break-words">{value}</span>
    </div>
  )
}

export function MovementDetailSheet({
  movement, account, category, isDemo, open, onOpenChange, onEdit, onDelete,
}: {
  movement: Movement
  account: Account | undefined
  category: Category | undefined
  isDemo?: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isIncome = movement.type === "income"
  const displayAmount = movement.converted_amount ?? movement.amount
  const displayCurrency = account?.currency ?? movement.original_currency
  const isCuota = movement.installment_purchase_id !== null
  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle del movimiento"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onDelete} disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="press-effect text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
          <Button onClick={onEdit} disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="press-effect">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <p className={cn("text-3xl font-bold tabular-nums leading-tight", isIncome ? "text-success" : "text-destructive")}>
            {isIncome ? "+ " : "− "}{formatCurrency(displayAmount, displayCurrency)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 divide-y divide-border/40">
          <DetailRow label="Categoría" value={category?.name ?? "Sin categoría"} />
          <DetailRow label="Cuenta" value={account?.name ?? "—"} />
          <DetailRow label="Fecha" value={format(parseISO(movement.date), "d 'de' MMMM yyyy", { locale: es })} />
          {movement.note ? <DetailRow label="Nota" value={movement.note} /> : null}
          {movement.tags.length > 0 ? (
            <DetailRow
              label="Tags"
              value={
                <div className="flex flex-wrap gap-1 justify-end">
                  {movement.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="h-5 text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              }
            />
          ) : null}
          {isCuota && movement.installment_number !== null && movement.installment_total !== null ? (
            <DetailRow label="Cuota" value={`${movement.installment_number}/${movement.installment_total}`} />
          ) : null}
          {movement.is_future ? <DetailRow label="Estado" value="Programado" /> : null}
        </div>
      </div>
    </MangoSheet>
  )
}

export function TransferDetailSheet({
  transfer, fromAccount, toAccount, isDemo, open, onOpenChange, onEdit, onDelete,
}: {
  transfer: Transfer
  fromAccount: Account | undefined
  toAccount: Account | undefined
  isDemo?: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isCross = fromAccount && toAccount && fromAccount.currency !== toAccount.currency
  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle de transferencia"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onDelete} disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="press-effect text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
          <Button onClick={onEdit} disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="press-effect">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums leading-tight">
            − {formatCurrency(transfer.from_amount, fromAccount?.currency ?? "ARS")}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 divide-y divide-border/40">
          <DetailRow label="Desde" value={fromAccount?.name ?? "—"} />
          <DetailRow label="Hacia" value={toAccount?.name ?? "—"} />
          {isCross ? (
            <DetailRow label="Monto recibido" value={`+ ${formatCurrency(transfer.to_amount, toAccount?.currency ?? "ARS")}`} />
          ) : null}
          <DetailRow label="Fecha" value={format(parseISO(transfer.date), "d 'de' MMMM yyyy", { locale: es })} />
          {transfer.note ? <DetailRow label="Nota" value={transfer.note} /> : null}
          {transfer.is_future ? <DetailRow label="Estado" value="Programado" /> : null}
        </div>
      </div>
    </MangoSheet>
  )
}
