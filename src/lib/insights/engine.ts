import { formatCurrency } from "@/lib/utils"
import type { BudgetProgress } from "@/lib/budgets"
import { format, parseISO, differenceInCalendarDays } from "date-fns"
import { es } from "date-fns/locale"

export interface Insight {
  /** stable-ish key for ordering/debug (NOT the weekly dedup key) */
  key: string
  emoji: string
  title: string
  body: string
  /** deep-link path */
  url: string
  /** higher = more important */
  priority: number
}

export interface InsightCard {
  name: string
  currency: "ARS" | "USD"
  /** next close date yyyy-MM-dd */
  closeDate: string
  /** current open-cycle expense total (account currency) */
  cycleAmount: number
  /** latest CLOSED statement total, or null if none */
  prevStatementAmount: number | null
}

export interface InsightInput {
  cards: InsightCard[]
  budgets: { name: string; progress: BudgetProgress }[]
  /** upcoming recurring occurrences within the next 7 days (already summed, ARS) */
  upcomingRecurring: { count: number; total: number }
  /** expense sums (ARS, converted) for the last 7 days vs the 7 before */
  spend: { thisWeek: number; prevWeek: number }
  /** inflación del último mes cerrado (IPC), si hay datos */
  inflation?: { monthLabel: string; ratePct: number } | null
  /** variación del dólar (tipo elegido) en los últimos 7 días, si hay datos */
  dollar?: { type: string; changePct: number } | null
  /** gasto de la semana nominal vs ajustado por inflación al mes actual (ARS) */
  realVsNominal?: { nominalWeek: number; realWeek: number; currency: string } | null
}

function pct(curr: number, base: number): number {
  if (base <= 0) return 0
  return Math.round(((curr - base) / base) * 100)
}

/** Generate the ranked weekly insights (deterministic). Returns up to `max` (default 3). */
export function generateInsights(input: InsightInput, ref: Date, max = 3): Insight[] {
  const out: Insight[] = []

  // 1. Tarjetas que cierran dentro de los próximos 7 días
  for (const c of input.cards) {
    const days = differenceInCalendarDays(parseISO(c.closeDate), ref)
    if (days < 0 || days > 7) continue
    const when = days === 0 ? "hoy" : days === 1 ? "mañana" : `el ${format(parseISO(c.closeDate), "EEEE d", { locale: es })}`
    const amount = formatCurrency(c.cycleAmount, c.currency)
    let delta = ""
    if (c.prevStatementAmount && c.prevStatementAmount > 0) {
      const d = pct(c.cycleAmount, c.prevStatementAmount)
      if (Math.abs(d) >= 1) delta = ` — ${d >= 0 ? "+" : ""}${d}% vs el resumen anterior`
    }
    out.push({
      key: `card_close:${c.name}:${c.closeDate}`,
      emoji: "💳",
      title: `Resumen de ${c.name}`,
      body: `Cierra ${when} y va ${amount}${delta}.`,
      url: "/tarjetas",
      priority: 90 - days,
    })
  }

  // 2. Presupuestos cerca o excedidos
  for (const b of input.budgets) {
    const p = b.progress
    if (p.status === "exceeded") {
      out.push({
        key: `budget_exceeded:${b.name}`,
        emoji: "🚨",
        title: `Te pasaste de "${b.name}"`,
        body: `Vas ${Math.round(p.percent)}% del presupuesto (${formatCurrency(p.spent, "ARS")} de ${formatCurrency(p.limit, "ARS")}).`,
        url: "/presupuestos",
        priority: 100,
      })
    } else if (p.status === "near") {
      out.push({
        key: `budget_near:${b.name}`,
        emoji: "⚠️",
        title: `Presupuesto "${b.name}" al límite`,
        body: `Ya usaste ${Math.round(p.percent)}% (${formatCurrency(p.spent, "ARS")} de ${formatCurrency(p.limit, "ARS")}).`,
        url: "/presupuestos",
        priority: 70,
      })
    }
  }

  // 3. Pagos recurrentes de la semana
  if (input.upcomingRecurring.count > 0) {
    const { count, total } = input.upcomingRecurring
    out.push({
      key: `recurring_week`,
      emoji: "🔁",
      title: "Pagos programados esta semana",
      body: `Tenés ${count} ${count === 1 ? "pago programado" : "pagos programados"}${total > 0 ? ` por ${formatCurrency(total, "ARS")}` : ""}.`,
      url: "/recurrentes",
      priority: 50,
    })
  }

  // 4. Tendencia de gasto (solo si el cambio es notable)
  const { thisWeek, prevWeek } = input.spend
  if (thisWeek > 0 && prevWeek > 0) {
    const d = pct(thisWeek, prevWeek)
    if (Math.abs(d) >= 10) {
      out.push({
        key: `spend_trend`,
        emoji: d >= 0 ? "📈" : "📉",
        title: "Tu gasto semanal",
        body: `Gastaste ${formatCurrency(thisWeek, "ARS")} en los últimos 7 días, ${Math.abs(d)}% ${d >= 0 ? "más" : "menos"} que la semana anterior.`,
        url: "/estadisticas",
        priority: 30,
      })
    }
  }

  // 5. Inflación del mes
  if (input.inflation) {
    const { monthLabel, ratePct } = input.inflation
    out.push({
      key: `inflation_month`,
      emoji: "📊",
      title: `Inflación de ${monthLabel}`,
      body: `La inflación de ${monthLabel} fue ${ratePct}%.`,
      url: "/estadisticas",
      priority: 65,
    })
  }

  // 6. Movimiento del dólar en la semana
  if (input.dollar && Math.abs(input.dollar.changePct) >= 1) {
    const { type, changePct } = input.dollar
    out.push({
      key: `dollar_move`,
      emoji: "💵",
      title: `Dólar ${type}`,
      body: `El dólar ${type} ${changePct >= 0 ? "subió" : "bajó"} ${Math.abs(changePct)}% esta semana.`,
      url: "/estadisticas",
      priority: 58,
    })
  }

  // 7. Gasto real vs nominal (ajustado por inflación)
  if (input.realVsNominal) {
    const { nominalWeek, realWeek, currency } = input.realVsNominal
    const d = pct(realWeek, nominalWeek)
    if (nominalWeek > 0 && d >= 1) {
      out.push({
        key: `real_vs_nominal`,
        emoji: "🧾",
        title: "Gasto real vs. nominal",
        body: `Gastaste ${formatCurrency(nominalWeek, currency as "ARS" | "USD")} esta semana; en pesos de hoy son ${formatCurrency(realWeek, currency as "ARS" | "USD")}.`,
        url: "/estadisticas",
        priority: 45,
      })
    }
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, max)
}
