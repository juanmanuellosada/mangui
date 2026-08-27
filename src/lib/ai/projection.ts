/**
 * Proyección de caja hasta fin de mes — el cálculo detrás de "¿cuánta plata
 * me va a sobrar a fin de mes?".
 *
 * Criterio de CAJA (no devengado): cuenta la plata que efectivamente entra o
 * sale de las cuentas líquidas entre hoy y la fecha de corte.
 *
 *   saldo_proyectado = saldo líquido actual
 *                    + ingresos previstos      (futuros ya cargados + recurrentes)
 *                    - egresos comprometidos   (futuros ya cargados + recurrentes + pagos de tarjeta que vencen)
 *                    - gasto variable estimado (ritmo histórico × días que faltan)
 *
 * Reglas de corte (las que evitan contar dos veces la misma plata):
 *   - Las tarjetas de crédito no entran en el saldo líquido, y sus consumos
 *     (incluidas las cuotas futuras) no cuentan como egreso: la salida de caja
 *     es el pago del resumen, que se pasa aparte en `pagos_tarjeta`.
 *   - Los recurrentes NO generan movimientos por adelantado (el cron los crea
 *     recién cuando vence la fecha), así que proyectarlos no duplica nada.
 *     Las cuotas SÍ se materializan como movimientos con is_future = true, y
 *     por eso entran por `movimientos_futuros` y no se recalculan aparte.
 *   - El ritmo histórico excluye cuotas, recurrentes y consumos de tarjeta:
 *     esos ya están contados como compromisos.
 *
 * Cada monto se imputa a la moneda en la que se mueve la plata (la de la
 * cuenta), con la misma regla que la vista `account_balances`.
 */
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import { computeNextRun } from "@/lib/recurring"
import { amountInCurrency } from "@/lib/money"
import type { Tables } from "@/lib/database.types"

export type Moneda = "ARS" | "USD"

export interface ProjectionAccount {
  id: string
  nombre: string
  tipo: string
  moneda: Moneda
  saldo: number
}

export interface ProjectionMovement {
  account_id: string
  type: "income" | "expense"
  date: string
  amount: number
  converted_amount: number | null
  original_currency: string
  note?: string | null
  installment_number?: number | null
  installment_total?: number | null
}

export interface ProjectionCardPayment {
  tarjeta: string
  moneda: Moneda
  monto: number
  vencimiento: string | null
  vencido: boolean
  /** Consumos del resumen en la otra moneda, sin equivalente guardado. */
  monto_otra_moneda: number
  otra_moneda: Moneda
}

export interface ProjectionInput {
  desde: string
  hasta: string
  cuentas: ProjectionAccount[]
  /** Movimientos con is_future = true entre `desde` y `hasta`. */
  movimientosFuturos: ProjectionMovement[]
  recurrentes: Tables<"recurring_transactions">[]
  pagosTarjeta: ProjectionCardPayment[]
  /** Gasto diario promedio de caja, por moneda (ritmo histórico). */
  gastoDiarioPromedio: Record<Moneda, number>
}

export interface ProyeccionMoneda {
  moneda: Moneda
  saldo_actual: number
  ingresos_previstos: number
  egresos_comprometidos: number
  gasto_variable_estimado: number
  gasto_diario_promedio: number
  flujo_neto: number
  /** Lo que queda a fin del período — la respuesta a "cuánto me sobra". */
  saldo_proyectado: number
}

export interface ProyeccionDetalleItem {
  concepto: string
  monto: number
  moneda: Moneda
  fecha: string
  origen: "recurrente" | "cuota" | "movimiento_futuro" | "tarjeta"
}

export interface ProyeccionResult {
  periodo: { desde: string; hasta: string; dias_restantes: number }
  ars: ProyeccionMoneda
  usd: ProyeccionMoneda
  ingresos: ProyeccionDetalleItem[]
  egresos: ProyeccionDetalleItem[]
  supuestos: string[]
}

const MAX_OCURRENCIAS = 45

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Fechas en las que un recurrente activo cae dentro de [desde, hasta].
 * Devuelve más de una para frecuencias cortas (semanal, quincenal, custom).
 */
export function occurrencesBetween(
  rec: Tables<"recurring_transactions">,
  desde: string,
  hasta: string
): string[] {
  if (desde > hasta) return []
  const found = new Set<string>()
  let cursor = parseISO(desde)

  for (let i = 0; i < MAX_OCURRENCIAS; i++) {
    const next = computeNextRun(rec, cursor)
    const str = toDateStr(next)
    if (str > hasta) break
    if (str >= desde && (!rec.end_date || str <= rec.end_date)) found.add(str)
    // El manejo de fin de semana puede correr la fecha hacia atrás: avanzar
    // siempre al menos un día para que el loop termine.
    const afterNext = addDays(next, 1)
    cursor = afterNext > cursor ? afterNext : addDays(cursor, 1)
  }

  return [...found].sort()
}

function emptyMoneda(moneda: Moneda): ProyeccionMoneda {
  return {
    moneda,
    saldo_actual: 0,
    ingresos_previstos: 0,
    egresos_comprometidos: 0,
    gasto_variable_estimado: 0,
    gasto_diario_promedio: 0,
    flujo_neto: 0,
    saldo_proyectado: 0,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeProjection(input: ProjectionInput): ProyeccionResult {
  const { desde, hasta, cuentas, movimientosFuturos, recurrentes, pagosTarjeta } = input

  const diasRestantes = Math.max(0, differenceInCalendarDays(parseISO(hasta), parseISO(desde)))

  const totales: Record<Moneda, ProyeccionMoneda> = {
    ARS: emptyMoneda("ARS"),
    USD: emptyMoneda("USD"),
  }
  const ingresos: ProyeccionDetalleItem[] = []
  const egresos: ProyeccionDetalleItem[] = []
  const supuestos: string[] = []

  // 1. Saldo líquido actual — las tarjetas de crédito quedan afuera (su deuda
  //    sale como pago del resumen, no como saldo negativo).
  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]))
  for (const c of cuentas) {
    if (c.tipo === "tarjeta_credito") continue
    totales[c.moneda].saldo_actual += c.saldo
  }

  // 2. Movimientos ya cargados con fecha futura (cuotas, sueldos programados…).
  //    Los de tarjeta se ignoran: se pagan vía resumen.
  let cuotasEnTarjeta = 0
  for (const m of movimientosFuturos) {
    if (m.date < desde || m.date > hasta) continue
    const cuenta = cuentaPorId.get(m.account_id)
    if (!cuenta) continue
    if (cuenta.tipo === "tarjeta_credito") {
      cuotasEnTarjeta++
      continue
    }
    const monto = amountInCurrency(m, cuenta.moneda)
    if (monto === 0) continue

    const esCuota = m.installment_number != null && m.installment_total != null
    const concepto = esCuota
      ? `${m.note ?? "Compra en cuotas"} (cuota ${m.installment_number}/${m.installment_total})`
      : (m.note ?? (m.type === "income" ? "Ingreso programado" : "Gasto programado"))
    const item: ProyeccionDetalleItem = {
      concepto,
      monto: round2(monto),
      moneda: cuenta.moneda,
      fecha: m.date,
      origen: esCuota ? "cuota" : "movimiento_futuro",
    }

    if (m.type === "income") {
      totales[cuenta.moneda].ingresos_previstos += monto
      ingresos.push(item)
    } else {
      totales[cuenta.moneda].egresos_comprometidos += monto
      egresos.push(item)
    }
  }

  // 3. Recurrentes activos que caen en el período. Los que se debitan de una
  //    tarjeta no son salida de caja: llegan en el resumen.
  let recurrentesEnTarjeta = 0
  for (const rec of recurrentes) {
    if (rec.status !== "active") continue
    if (rec.kind === "transfer") continue

    const cuenta = rec.account_id ? cuentaPorId.get(rec.account_id) : undefined
    if (cuenta?.tipo === "tarjeta_credito" || rec.is_card_recurring) {
      recurrentesEnTarjeta++
      continue
    }

    const moneda: Moneda = rec.currency === "USD" ? "USD" : "ARS"
    for (const fecha of occurrencesBetween(rec, desde, hasta)) {
      const item: ProyeccionDetalleItem = {
        concepto: rec.note ?? `Recurrente ${rec.frequency}`,
        monto: round2(rec.amount),
        moneda,
        fecha,
        origen: "recurrente",
      }
      if (rec.kind === "income") {
        totales[moneda].ingresos_previstos += rec.amount
        ingresos.push(item)
      } else {
        totales[moneda].egresos_comprometidos += rec.amount
        egresos.push(item)
      }
    }
  }

  // 4. Pagos de tarjeta que vencen dentro del período (o ya vencidos e impagos).
  for (const pago of pagosTarjeta) {
    if (pago.monto > 0) {
      totales[pago.moneda].egresos_comprometidos += pago.monto
      egresos.push({
        concepto: `Resumen ${pago.tarjeta}${pago.vencido ? " (vencido)" : ""}`,
        monto: round2(pago.monto),
        moneda: pago.moneda,
        fecha: pago.vencimiento ?? hasta,
        origen: "tarjeta",
      })
    }
    if (pago.monto_otra_moneda > 0) {
      totales[pago.otra_moneda].egresos_comprometidos += pago.monto_otra_moneda
      egresos.push({
        concepto: `Resumen ${pago.tarjeta} — consumos en ${pago.otra_moneda}`,
        monto: round2(pago.monto_otra_moneda),
        moneda: pago.otra_moneda,
        fecha: pago.vencimiento ?? hasta,
        origen: "tarjeta",
      })
    }
  }

  // 5. Gasto variable estimado: el ritmo histórico de gasto de caja por los
  //    días que faltan.
  for (const moneda of ["ARS", "USD"] as const) {
    const t = totales[moneda]
    const diario = input.gastoDiarioPromedio[moneda] ?? 0
    t.gasto_diario_promedio = round2(diario)
    t.gasto_variable_estimado = round2(diario * diasRestantes)
    t.saldo_actual = round2(t.saldo_actual)
    t.ingresos_previstos = round2(t.ingresos_previstos)
    t.egresos_comprometidos = round2(t.egresos_comprometidos)
    t.flujo_neto = round2(
      t.ingresos_previstos - t.egresos_comprometidos - t.gasto_variable_estimado
    )
    t.saldo_proyectado = round2(t.saldo_actual + t.flujo_neto)
  }

  // 6. Supuestos — para que el asistente pueda explicar de dónde sale el número.
  supuestos.push(
    "El saldo proyectado es plata líquida: no incluye las tarjetas de crédito como saldo, sino el pago de su resumen cuando vence."
  )
  supuestos.push(
    `El gasto variable estimado sale del ritmo de gasto de los últimos 90 días (excluye cuotas, recurrentes y consumos con tarjeta) multiplicado por los ${diasRestantes} días que faltan.`
  )
  if (cuotasEnTarjeta > 0) {
    supuestos.push(
      `Hay ${cuotasEnTarjeta} consumo(s) futuro(s) cargado(s) en tarjeta dentro del período: no se cuentan como salida ahora porque se pagan en el resumen correspondiente.`
    )
  }
  if (recurrentesEnTarjeta > 0) {
    supuestos.push(
      `Hay ${recurrentesEnTarjeta} recurrente(s) que se debitan de una tarjeta: llegan en el resumen, no como salida directa de caja.`
    )
  }
  supuestos.push(
    "No se proyectan transferencias entre cuentas propias: no cambian el total."
  )

  ingresos.sort((a, b) => a.fecha.localeCompare(b.fecha))
  egresos.sort((a, b) => a.fecha.localeCompare(b.fecha))

  return {
    periodo: { desde, hasta, dias_restantes: diasRestantes },
    ars: totales.ARS,
    usd: totales.USD,
    ingresos,
    egresos,
    supuestos,
  }
}
