import { addDays, format, getDaysInMonth, parseISO, startOfMonth, subDays } from "date-fns"
import { detectUnusualCharge, type UnusualChargeMovement } from "@/lib/insights/unusual"
import { amountInCurrency } from "@/lib/money"

export interface SmartDashboardMovement extends UnusualChargeMovement {
  note?: string | null
}

export type SmartDashboardSignal =
  | {
      kind: "unusual_charge"
      id: string
      priority: number
      href: "/movimientos"
      movementId: string
      categoryId: string | null
      amount: number
      ratio: number
    }
  | {
      kind: "spending_pace"
      id: "spending-pace"
      priority: number
      href: "/estadisticas"
      spent: number
      projected: number
      daysRemaining: number
    }
  | {
      kind: "upcoming_movements"
      id: "upcoming-movements"
      priority: number
      href: "/movimientos"
      count: number
      expenseTotal: number
    }

const MAX_SIGNALS = 4
const RECENT_UNUSUAL_DAYS = 14

/**
 * Builds the deterministic, read-only signals shown by the smart dashboard.
 * All amounts are normalized to ARS so mixed-currency movements are not added
 * without a known conversion.
 */
export function buildSmartDashboardSignals(
  movements: SmartDashboardMovement[],
  today: string,
): SmartDashboardSignal[] {
  const todayDate = parseISO(today)
  const monthStart = format(startOfMonth(todayDate), "yyyy-MM-dd")
  const recentUnusualCutoff = format(subDays(todayDate, RECENT_UNUSUAL_DAYS), "yyyy-MM-dd")

  const signals: SmartDashboardSignal[] = []

  let highestUnusual: SmartDashboardSignal | null = null
  for (const movement of movements) {
    if (movement.date < recentUnusualCutoff || movement.date > today) continue

    const result = detectUnusualCharge(movement, movements)
    if (!result?.isUnusual) continue

    const candidate: SmartDashboardSignal = {
      kind: "unusual_charge",
      id: `unusual-charge-${movement.id}`,
      priority: 300,
      href: "/movimientos",
      movementId: movement.id,
      categoryId: movement.category_id,
      amount: amountInCurrency(movement, "ARS"),
      ratio: result.ratio,
    }

    if (!highestUnusual || candidate.ratio > highestUnusual.ratio) {
      highestUnusual = candidate
    }
  }
  if (highestUnusual) signals.push(highestUnusual)

  const monthExpenses = movements.filter(
    (movement) =>
      movement.type === "expense" &&
      !movement.is_future &&
      movement.date >= monthStart &&
      movement.date <= today,
  )
  const spent = monthExpenses.reduce(
    (total, movement) => total + amountInCurrency(movement, "ARS"),
    0,
  )
  const elapsedDays = todayDate.getDate()
  const daysInMonth = getDaysInMonth(todayDate)

  if (spent > 0 && elapsedDays > 0) {
    signals.push({
      kind: "spending_pace",
      id: "spending-pace",
      priority: 200,
      href: "/estadisticas",
      spent,
      projected: (spent / elapsedDays) * daysInMonth,
      daysRemaining: daysInMonth - elapsedDays,
    })
  }

  const upcomingEnd = format(addDays(todayDate, 7), "yyyy-MM-dd")
  const upcoming = movements.filter(
    (movement) => movement.is_future && movement.date > today && movement.date <= upcomingEnd,
  )
  if (upcoming.length > 0) {
    signals.push({
      kind: "upcoming_movements",
      id: "upcoming-movements",
      priority: 100,
      href: "/movimientos",
      count: upcoming.length,
      expenseTotal: upcoming
        .filter((movement) => movement.type === "expense")
        .reduce((total, movement) => total + amountInCurrency(movement, "ARS"), 0),
    })
  }

  return signals
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_SIGNALS)
}
