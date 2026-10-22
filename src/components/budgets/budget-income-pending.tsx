import { formatCurrency } from "@/lib/utils"
import type { Budget } from "@/lib/budgets"

/** Estado neutral: no representa un presupuesto saludable ni un límite de cero. */
export function BudgetIncomePending({ budget, spent }: { budget: Budget; spent: number }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{budget.name} · {budget.income_percentage}% de ingresos</p>
      <p className="text-muted-foreground">Sin ingresos registrados</p>
      <p className="text-xs text-muted-foreground">
        Registrá ingresos en las cuentas del presupuesto para calcular el límite de este período.
      </p>
      <p className="text-xs tabular-nums">Gastado: {formatCurrency(spent, budget.currency)}</p>
    </div>
  )
}
