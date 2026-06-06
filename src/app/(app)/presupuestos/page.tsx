import type { Metadata } from "next"
import { BudgetsList } from "@/components/budgets/budgets-list"

export const metadata: Metadata = {
  title: "Presupuestos",
}

export default function PresupuestosPage() {
  return <BudgetsList />
}
