/**
 * AI chatbot tool handlers.
 *
 * Each function takes the session Supabase client (RLS-scoped) and optional
 * filter params. They NEVER accept a user_id from the model — the session
 * client enforces row-level security automatically.
 *
 * These are called from the route handler which injects the session client.
 */
import { startOfMonth, format, addMonths, parseISO } from "date-fns"
import {
  summaryTotals,
  categoryDistribution,
  filterMovements,
} from "@/lib/stats"
import {
  computeBudgetProgress,
  activeBudgetWindow,
} from "@/lib/budgets"
import { computeGoalProgress, type GoalScope } from "@/lib/goals"
import { computeNextRun } from "@/lib/recurring"
import { computeInstallmentDate } from "@/lib/installments"
import { nextCardPayment, listCardCycles, toDateString } from "@/lib/cards"
import { resolveEntity, normalizeText } from "@/lib/entity-resolver"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type SessionClient = SupabaseClient<Database>

// ── helpers ───────────────────────────────────────────────────────────────────

function todayAR(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  })
}

// ── obtener_saldos ────────────────────────────────────────────────────────────

export interface SaldosResult {
  cuentas: Array<{
    nombre: string
    tipo: string
    moneda: string
    saldo: number
  }>
  total_ars: number
  total_usd: number
}

export async function obtenerSaldos(supabase: SessionClient): Promise<SaldosResult> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("account_name, account_type, currency, current_balance, is_hidden")

  if (error) throw new Error(`Error al obtener saldos: ${error.message}`)

  const rows = (data ?? []).filter((r) => !r.is_hidden)

  let total_ars = 0
  let total_usd = 0
  const cuentas = rows.map((r) => {
    const saldo = r.current_balance ?? 0
    if (r.currency === "USD") total_usd += saldo
    else total_ars += saldo
    return {
      nombre: r.account_name ?? "",
      tipo: r.account_type ?? "",
      moneda: r.currency ?? "ARS",
      saldo,
    }
  })

  return { cuentas, total_ars, total_usd }
}

// ── estadisticas_gastos ───────────────────────────────────────────────────────

export interface EstadisticasGastosParams {
  desde?: string
  hasta?: string
  moneda?: "ARS" | "USD"
}

export interface EstadisticasGastosResult {
  ingresos: number
  gastos: number
  neto: number
  moneda: string
  periodo: { desde: string; hasta: string }
  top_categorias_gastos: Array<{ categoria: string; total: number; porcentaje: number }>
  top_categorias_ingresos: Array<{ categoria: string; total: number; porcentaje: number }>
}

export async function estadisticasGastos(
  supabase: SessionClient,
  params: EstadisticasGastosParams
): Promise<EstadisticasGastosResult> {
  const today = todayAR()
  const desde = params.desde ?? format(startOfMonth(new Date()), "yyyy-MM-dd")
  const hasta = params.hasta ?? today
  const moneda = params.moneda

  const [movsRes, catsRes] = await Promise.all([
    supabase
      .from("movements")
      .select("type, is_future, date, category_id, account_id, amount, converted_amount, original_currency")
      .gte("date", desde)
      .lte("date", hasta)
      .eq("is_future", false),
    supabase.from("categories").select("id, name, type"),
  ])

  if (movsRes.error) throw new Error(movsRes.error.message)
  if (catsRes.error) throw new Error(catsRes.error.message)

  const movements = movsRes.data ?? []
  const categories = catsRes.data ?? []

  const filtered = filterMovements(movements as Parameters<typeof filterMovements>[0], {
    dateFrom: desde,
    dateTo: hasta,
    currency: moneda,
  })

  const totals = summaryTotals(filtered, moneda)

  const topExpense = categoryDistribution(filtered, "expense", categories, moneda)
    .slice(0, 5)
    .map((c) => ({ categoria: c.name, total: c.total, porcentaje: Math.round(c.percent) }))

  const topIncome = categoryDistribution(filtered, "income", categories, moneda)
    .slice(0, 5)
    .map((c) => ({ categoria: c.name, total: c.total, porcentaje: Math.round(c.percent) }))

  return {
    ingresos: Math.round(totals.income),
    gastos: Math.round(totals.expense),
    neto: Math.round(totals.net),
    moneda: moneda ?? "ARS+USD",
    periodo: { desde, hasta },
    top_categorias_gastos: topExpense,
    top_categorias_ingresos: topIncome,
  }
}

// ── buscar_movimientos ────────────────────────────────────────────────────────

export interface BuscarMovimientosParams {
  texto?: string
  tipo?: "income" | "expense"
  desde?: string
  hasta?: string
  categoria?: string
  cuenta?: string
  limite?: number
}

export interface BuscarMovimientosResult {
  movimientos: Array<{
    fecha: string
    tipo: string
    monto: number
    moneda: string
    categoria: string | null
    cuenta: string
    nota: string | null
  }>
  total_encontrados: number
  advertencias?: string[]
}

export async function buscarMovimientos(
  supabase: SessionClient,
  params: BuscarMovimientosParams
): Promise<BuscarMovimientosResult> {
  const limite = Math.min(params.limite ?? 20, 50)

  // Load categories and accounts for name resolution
  const [catsRes, accsRes] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("accounts").select("id, name, is_hidden"),
  ])

  const categories = catsRes.data ?? []
  const accounts = accsRes.data ?? []

  // Resolve names → ids for filtering
  const advertencias: string[] = []

  const categoriaResuelta = params.categoria ? resolveEntity(params.categoria, categories) : null
  const categoryId = categoriaResuelta?.resolved ? categoriaResuelta.id : null
  if (params.categoria && !categoriaResuelta?.resolved) {
    advertencias.push(
      `No pude identificar la categoría "${params.categoria}", así que no se filtró por categoría.`
    )
  }

  const cuentaResuelta = params.cuenta
    ? resolveEntity(params.cuenta, accounts, { isHidden: (a) => a.is_hidden })
    : null
  const accountId = cuentaResuelta?.resolved ? cuentaResuelta.id : null
  if (params.cuenta && !cuentaResuelta?.resolved) {
    advertencias.push(
      `No pude identificar la cuenta "${params.cuenta}", así que no se filtró por cuenta.`
    )
  }

  let q = supabase
    .from("movements")
    .select("date, type, amount, converted_amount, original_currency, category_id, account_id, note")
    .eq("is_future", false)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite)

  if (params.desde) q = q.gte("date", params.desde)
  if (params.hasta) q = q.lte("date", params.hasta)
  if (params.tipo) q = q.eq("type", params.tipo)
  if (categoryId) q = q.eq("category_id", categoryId)
  if (accountId) q = q.eq("account_id", accountId)

  if (params.texto?.trim()) {
    const escaped = params.texto.trim().replace(/[%_(),]/g, (c) => `\\${c}`)
    const orParts: string[] = [`note.ilike.%${escaped}%`]
    const normalizedTexto = normalizeText(params.texto)
    const matchCatIds = categories
      .filter((c) => normalizeText(c.name).includes(normalizedTexto))
      .map((c) => c.id)
    const matchAccIds = accounts
      .filter((a) => normalizeText(a.name).includes(normalizedTexto))
      .map((a) => a.id)
    if (matchCatIds.length > 0) orParts.push(`category_id.in.(${matchCatIds.join(",")})`)
    if (matchAccIds.length > 0) orParts.push(`account_id.in.(${matchAccIds.join(",")})`)
    q = q.or(orParts.join(","))
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const catMap = new Map(categories.map((c) => [c.id, c.name]))
  const accMap = new Map(accounts.map((a) => [a.id, a.name]))

  const movimientos = (data ?? []).map((m) => ({
    fecha: m.date,
    tipo: m.type,
    monto: m.amount,
    moneda: m.original_currency ?? "ARS",
    categoria: m.category_id ? (catMap.get(m.category_id) ?? null) : null,
    cuenta: accMap.get(m.account_id) ?? m.account_id,
    nota: m.note ?? null,
  }))

  return {
    movimientos,
    total_encontrados: movimientos.length,
    ...(advertencias.length > 0 ? { advertencias } : {}),
  }
}

// ── pagos_futuros ─────────────────────────────────────────────────────────────

export interface PagosFuturosParams {
  hasta?: string
}

export interface PagosFuturosResult {
  recurrentes: Array<{ nombre: string; tipo: string; monto: number; moneda: string; proximo: string; frecuencia: string }>
  cuotas: Array<{ descripcion: string; cuota: string; monto: number; moneda: string; fecha: string }>
  tarjetas: Array<{ tarjeta: string; monto_adeudado: number; moneda: string; vencimiento: string | null }>
}

export async function pagosFuturos(
  supabase: SessionClient,
  params: PagosFuturosParams
): Promise<PagosFuturosResult> {
  const today = todayAR()
  const hasta = params.hasta ?? toDateString(addMonths(parseISO(today), 3))

  // Load data in parallel
  const [recurringRes, installmentsRes, accountsRes, statementsRes, movsRes] =
    await Promise.all([
      supabase
        .from("recurring_transactions")
        .select("*")
        .eq("status", "active"),
      supabase
        .from("installment_purchases")
        .select("*"),
      supabase
        .from("accounts")
        .select("id, name, type, currency, closing_date, due_date")
        .eq("is_hidden", false),
      supabase
        .from("card_statements")
        .select("account_id, total_amount, total_amount_usd, due_date, close_date")
        .eq("status", "pendiente"),
      supabase
        .from("movements")
        .select("account_id, type, date, amount, converted_amount, original_currency")
        .in("type", ["expense", "income"]),
    ])

  // Recurring: compute next run for each active recurring
  const recurringRows = recurringRes.data ?? []
  const recurrentes = recurringRows
    .filter((r) => r.kind !== "transfer")
    .map((r) => {
      const nextRun = computeNextRun(r as Parameters<typeof computeNextRun>[0], new Date(today))
      const nextStr = toDateString(nextRun)
      return { r, nextStr }
    })
    .filter(({ nextStr }) => nextStr <= hasta)
    .map(({ r, nextStr }) => ({
      nombre: r.note ?? `Recurrente ${r.kind} (${r.frequency})`,
      tipo: r.kind,
      monto: r.amount,
      moneda: r.currency ?? "ARS",
      proximo: nextStr,
      frecuencia: r.frequency,
    }))
    .sort((a, b) => a.proximo.localeCompare(b.proximo))

  // Installments: future cuotas
  const installmentRows = installmentsRes.data ?? []
  const cuotas: PagosFuturosResult["cuotas"] = []
  for (const inst of installmentRows) {
    for (let i = 1; i <= inst.installments_count; i++) {
      const fecha = computeInstallmentDate(inst.start_date, i)
      if (fecha > today && fecha <= hasta) {
        const isFinal = i === inst.installments_count
        const perAmount = Math.floor((inst.total_amount / inst.installments_count) * 100) / 100
        const monto = isFinal
          ? Math.round((inst.total_amount - perAmount * (inst.installments_count - 1)) * 100) / 100
          : perAmount
        cuotas.push({
          descripcion: inst.description,
          cuota: `${i}/${inst.installments_count}`,
          monto,
          moneda: inst.currency ?? "ARS",
          fecha,
        })
      }
    }
  }
  cuotas.sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Credit card payments
  const creditCards = (accountsRes.data ?? []).filter((a) => a.type === "tarjeta_credito")
  const statements = statementsRes.data ?? []
  const movements = movsRes.data ?? []
  const tarjetas: PagosFuturosResult["tarjetas"] = []

  for (const card of creditCards) {
    const payment = nextCardPayment(
      card.id,
      { closing_date: card.closing_date, due_date: card.due_date, currency: card.currency },
      statements as Parameters<typeof nextCardPayment>[2],
      movements as Parameters<typeof nextCardPayment>[3]
    )
    if (payment.amount > 0) {
      tarjetas.push({
        tarjeta: card.name,
        monto_adeudado: Math.round(payment.amount),
        moneda: card.currency,
        vencimiento: payment.dueDate,
      })
    }
  }

  return { recurrentes, cuotas, tarjetas }
}

// ── resumenes_tarjeta ─────────────────────────────────────────────────────────

export interface ResumenesTarjetaParams {
  tarjeta?: string
}

export interface ResumenesTarjetaResult {
  tarjetas: Array<{
    nombre: string
    ciclo_actual: { cierre: string | null; vencimiento: string | null; total: number }
    ultimos_ciclos: Array<{ cierre: string; vencimiento: string | null; total: number; pagado: boolean }>
  }>
  advertencia?: string
}

export async function resumenesTarjeta(
  supabase: SessionClient,
  params: ResumenesTarjetaParams
): Promise<ResumenesTarjetaResult> {
  const [accountsRes, movsRes, statementsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, currency, closing_date, due_date")
      .eq("type", "tarjeta_credito")
      .eq("is_hidden", false),
    supabase
      .from("movements")
      .select("id, account_id, type, date, amount, converted_amount, original_currency, import_statement_id"),
    supabase.from("card_statements").select("*"),
  ])

  let creditCards = accountsRes.data ?? []
  let advertencia: string | undefined
  if (params.tarjeta) {
    const tarjetaResuelta = resolveEntity(params.tarjeta, creditCards)
    if (tarjetaResuelta.resolved) {
      creditCards = creditCards.filter((c) => c.id === tarjetaResuelta.id)
    } else {
      advertencia = `No pude identificar la tarjeta "${params.tarjeta}", así que se muestran todas las tarjetas.`
    }
  }

  const allMovements = movsRes.data ?? []
  const allStatements = statementsRes.data ?? []

  const result: ResumenesTarjetaResult["tarjetas"] = []

  for (const card of creditCards) {
    const cycles = listCardCycles(
      card.id,
      { closing_date: card.closing_date, due_date: card.due_date, currency: card.currency },
      allMovements as Parameters<typeof listCardCycles>[2],
      allStatements as Parameters<typeof listCardCycles>[3]
    )

    // Current = last cycle
    const current = cycles[cycles.length - 1]
    const ciclo_actual = {
      cierre: current?.closeDate ?? null,
      vencimiento: current?.dueDate ?? null,
      total: Math.round(current?.total ?? 0),
    }

    // Previous 3 paid cycles
    const ultimos_ciclos = cycles
      .slice(-4, -1)
      .reverse()
      .map((c) => ({
        cierre: c.closeDate,
        vencimiento: c.dueDate,
        total: Math.round(c.statement?.total_amount ?? c.total),
        pagado: c.statement?.status === "pagado",
      }))

    result.push({ nombre: card.name, ciclo_actual, ultimos_ciclos })
  }

  return { tarjetas: result, ...(advertencia ? { advertencia } : {}) }
}

// ── estado_presupuestos ───────────────────────────────────────────────────────

export interface EstadoPresupuestosResult {
  presupuestos: Array<{
    nombre: string
    periodo: string
    gastado: number
    limite: number
    porcentaje: number
    restante: number
    estado: string
    ventana: { desde: string; hasta: string }
  }>
}

export async function estadoPresupuestos(
  supabase: SessionClient
): Promise<EstadoPresupuestosResult> {
  const [budgetsRes, movsRes] = await Promise.all([
    supabase.from("budgets").select("*").eq("status", "active"),
    supabase
      .from("movements")
      .select("type, is_future, date, category_id, account_id, amount, converted_amount, original_currency")
      .eq("is_future", false),
  ])

  const budgets = budgetsRes.data ?? []
  const movements = movsRes.data ?? []

  const presupuestos = budgets.map((b) => {
    const progress = computeBudgetProgress(
      b as Parameters<typeof computeBudgetProgress>[0],
      movements as Parameters<typeof computeBudgetProgress>[1]
    )
    const window = activeBudgetWindow(b as Parameters<typeof activeBudgetWindow>[0])
    const periodoLabel = b.period ?? "personalizado"

    return {
      nombre: b.name,
      periodo: periodoLabel,
      gastado: Math.round(progress.spent),
      limite: Math.round(progress.limit),
      porcentaje: Math.round(progress.percent),
      restante: Math.round(progress.remaining),
      estado: progress.status,
      ventana: { desde: window.from, hasta: window.to },
    }
  })

  return { presupuestos }
}

// ── estado_metas ──────────────────────────────────────────────────────────────

export interface EstadoMetasResult {
  metas: Array<{
    nombre: string
    tipo: string
    valor_actual: number
    objetivo: number
    porcentaje: number
    estado: string
    periodo: { desde: string; hasta: string }
  }>
}

export async function estadoMetas(
  supabase: SessionClient
): Promise<EstadoMetasResult> {
  const [goalsRes, goalAccountsRes, goalCategoriesRes, movsRes] = await Promise.all([
    supabase.from("goals").select("*").eq("status", "active"),
    supabase.from("goal_accounts").select("goal_id, account_id"),
    supabase.from("goal_categories").select("goal_id, category_id"),
    supabase
      .from("movements")
      .select("type, is_future, date, category_id, account_id, amount, converted_amount, original_currency")
      .eq("is_future", false),
  ])

  const goals = goalsRes.data ?? []
  const goalAccounts = goalAccountsRes.data ?? []
  const goalCategories = goalCategoriesRes.data ?? []
  const movements = movsRes.data ?? []

  const metas = goals.map((g) => {
    const scope: GoalScope = {
      accountIds: goalAccounts.filter((ga) => ga.goal_id === g.id).map((ga) => ga.account_id),
      categoryIds: goalCategories.filter((gc) => gc.goal_id === g.id).map((gc) => gc.category_id),
    }
    const progress = computeGoalProgress(
      g as Parameters<typeof computeGoalProgress>[0],
      movements as Parameters<typeof computeGoalProgress>[1],
      scope
    )

    return {
      nombre: g.name,
      tipo: g.type,
      valor_actual: Math.round(progress.value),
      objetivo: Math.round(progress.target),
      porcentaje: Math.round(progress.percent),
      estado: progress.status,
      periodo: { desde: g.start_date, hasta: g.end_date },
    }
  })

  return { metas }
}
