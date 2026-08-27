import { describe, it, expect } from "vitest"
import {
  occurrencesBetween,
  computeProjection,
  type ProjectionAccount,
  type ProjectionInput,
} from "./projection"
import type { Tables } from "@/lib/database.types"

type Recurring = Tables<"recurring_transactions">

function recurrente(overrides: Partial<Recurring>): Recurring {
  return {
    account_id: "cuenta-banco",
    amount: 100_000,
    category_id: null,
    created_at: "2026-01-01T00:00:00Z",
    currency: "ARS",
    day_of_month: 10,
    day_of_week: null,
    end_date: null,
    frequency: "monthly",
    id: "rec-1",
    interval_days: null,
    is_card_recurring: false,
    kind: "expense",
    month_of_year: null,
    next_run: null,
    note: "Alquiler",
    source_key: null,
    start_date: "2026-01-10",
    status: "active",
    to_account_id: null,
    to_amount: null,
    updated_at: "2026-01-01T00:00:00Z",
    user_id: "user-1",
    weekend_handling: "as_is",
    ...overrides,
  } as Recurring
}

const banco: ProjectionAccount = {
  id: "cuenta-banco",
  nombre: "Banco",
  tipo: "caja_ahorro",
  moneda: "ARS",
  saldo: 1_000_000,
}

const tarjeta: ProjectionAccount = {
  id: "cuenta-tarjeta",
  nombre: "Visa",
  tipo: "tarjeta_credito",
  moneda: "ARS",
  saldo: -300_000,
}

function input(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    desde: "2026-08-27",
    hasta: "2026-08-31",
    cuentas: [banco],
    movimientosFuturos: [],
    recurrentes: [],
    pagosTarjeta: [],
    gastoDiarioPromedio: { ARS: 0, USD: 0 },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// occurrencesBetween
// ---------------------------------------------------------------------------
describe("occurrencesBetween", () => {
  it("incluye la ocurrencia mensual que cae dentro de la ventana", () => {
    const rec = recurrente({ day_of_month: 28 })
    expect(occurrencesBetween(rec, "2026-08-27", "2026-08-31")).toEqual(["2026-08-28"])
  })

  it("deja afuera la mensual que ya pasó este mes", () => {
    const rec = recurrente({ day_of_month: 5 })
    expect(occurrencesBetween(rec, "2026-08-27", "2026-08-31")).toEqual([])
  })

  it("devuelve todas las ocurrencias de una semanal", () => {
    const rec = recurrente({ frequency: "weekly", day_of_week: 1 })
    // Lunes de septiembre 2026: 7, 14, 21, 28
    expect(occurrencesBetween(rec, "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ])
  })

  it("respeta end_date", () => {
    const rec = recurrente({ frequency: "weekly", day_of_week: 1, end_date: "2026-09-15" })
    expect(occurrencesBetween(rec, "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-07",
      "2026-09-14",
    ])
  })

  it("devuelve vacío cuando la ventana está invertida", () => {
    expect(occurrencesBetween(recurrente({}), "2026-09-10", "2026-09-01")).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// computeProjection
// ---------------------------------------------------------------------------
describe("computeProjection", () => {
  it("sin movimientos ni compromisos, el saldo proyectado es el saldo actual", () => {
    const r = computeProjection(input())
    expect(r.ars.saldo_actual).toBe(1_000_000)
    expect(r.ars.saldo_proyectado).toBe(1_000_000)
    expect(r.periodo.dias_restantes).toBe(4)
  })

  it("deja la tarjeta de crédito afuera del saldo líquido", () => {
    const r = computeProjection(input({ cuentas: [banco, tarjeta] }))
    expect(r.ars.saldo_actual).toBe(1_000_000)
  })

  it("cuenta el pago del resumen como egreso comprometido", () => {
    const r = computeProjection(
      input({
        cuentas: [banco, tarjeta],
        pagosTarjeta: [
          {
            tarjeta: "Visa",
            moneda: "ARS",
            monto: 300_000,
            vencimiento: "2026-08-30",
            vencido: false,
            monto_otra_moneda: 50,
            otra_moneda: "USD",
          },
        ],
      })
    )
    expect(r.ars.egresos_comprometidos).toBe(300_000)
    expect(r.ars.saldo_proyectado).toBe(700_000)
    // Los consumos en dólares del mismo resumen van al bucket USD, sin convertir.
    expect(r.usd.egresos_comprometidos).toBe(50)
    expect(r.egresos).toHaveLength(2)
  })

  it("ignora los consumos futuros cargados en la tarjeta (se pagan por resumen)", () => {
    const r = computeProjection(
      input({
        cuentas: [banco, tarjeta],
        movimientosFuturos: [
          {
            account_id: "cuenta-tarjeta",
            type: "expense",
            date: "2026-08-28",
            amount: 80_000,
            converted_amount: null,
            original_currency: "ARS",
            note: "Notebook",
            installment_number: 2,
            installment_total: 6,
          },
        ],
      })
    )
    expect(r.ars.egresos_comprometidos).toBe(0)
    expect(r.supuestos.some((s) => s.includes("tarjeta dentro del período"))).toBe(true)
  })

  it("suma cuotas y sueldos programados en cuentas líquidas", () => {
    const r = computeProjection(
      input({
        movimientosFuturos: [
          {
            account_id: "cuenta-banco",
            type: "income",
            date: "2026-08-31",
            amount: 500_000,
            converted_amount: null,
            original_currency: "ARS",
            note: "Sueldo",
          },
          {
            account_id: "cuenta-banco",
            type: "expense",
            date: "2026-08-29",
            amount: 20_000,
            converted_amount: null,
            original_currency: "ARS",
            note: "Heladera",
            installment_number: 3,
            installment_total: 12,
          },
        ],
      })
    )
    expect(r.ars.ingresos_previstos).toBe(500_000)
    expect(r.ars.egresos_comprometidos).toBe(20_000)
    expect(r.ars.saldo_proyectado).toBe(1_480_000)
    expect(r.egresos[0].concepto).toBe("Heladera (cuota 3/12)")
  })

  it("descarta los movimientos futuros fuera del período", () => {
    const r = computeProjection(
      input({
        movimientosFuturos: [
          {
            account_id: "cuenta-banco",
            type: "expense",
            date: "2026-09-15",
            amount: 20_000,
            converted_amount: null,
            original_currency: "ARS",
            note: "Cuota del mes que viene",
          },
        ],
      })
    )
    expect(r.ars.egresos_comprometidos).toBe(0)
  })

  it("proyecta los recurrentes que caen en el período", () => {
    const r = computeProjection(
      input({
        recurrentes: [
          recurrente({ id: "r1", kind: "expense", day_of_month: 28, amount: 400_000 }),
          recurrente({ id: "r2", kind: "income", day_of_month: 30, amount: 900_000, note: "Sueldo" }),
          recurrente({ id: "r3", kind: "expense", day_of_month: 5, amount: 111_111 }),
        ],
      })
    )
    expect(r.ars.egresos_comprometidos).toBe(400_000)
    expect(r.ars.ingresos_previstos).toBe(900_000)
    expect(r.ars.saldo_proyectado).toBe(1_500_000)
  })

  it("no cuenta como salida de caja los recurrentes que se debitan de la tarjeta", () => {
    const r = computeProjection(
      input({
        cuentas: [banco, tarjeta],
        recurrentes: [
          recurrente({
            id: "r1",
            account_id: "cuenta-tarjeta",
            is_card_recurring: true,
            day_of_month: 28,
            amount: 30_000,
          }),
        ],
      })
    )
    expect(r.ars.egresos_comprometidos).toBe(0)
    expect(r.supuestos.some((s) => s.includes("se debitan de una tarjeta"))).toBe(true)
  })

  it("ignora los recurrentes pausados y las transferencias", () => {
    const r = computeProjection(
      input({
        recurrentes: [
          recurrente({ id: "r1", status: "paused", day_of_month: 28, amount: 500_000 }),
          recurrente({ id: "r2", kind: "transfer", day_of_month: 28, amount: 500_000 }),
        ],
      })
    )
    expect(r.ars.egresos_comprometidos).toBe(0)
  })

  it("descuenta el gasto variable estimado por los días que faltan", () => {
    const r = computeProjection(input({ gastoDiarioPromedio: { ARS: 25_000, USD: 0 } }))
    expect(r.periodo.dias_restantes).toBe(4)
    expect(r.ars.gasto_variable_estimado).toBe(100_000)
    expect(r.ars.saldo_proyectado).toBe(900_000)
    expect(r.ars.flujo_neto).toBe(-100_000)
  })

  it("imputa cada monto a la moneda de la cuenta usando converted_amount", () => {
    const cajaUsd: ProjectionAccount = {
      id: "cuenta-usd",
      nombre: "Dólares",
      tipo: "caja_ahorro",
      moneda: "USD",
      saldo: 5_000,
    }
    const r = computeProjection(
      input({
        cuentas: [banco, cajaUsd],
        movimientosFuturos: [
          {
            account_id: "cuenta-usd",
            type: "expense",
            date: "2026-08-28",
            amount: 150_000,
            converted_amount: 100,
            original_currency: "ARS",
            note: "Gasto en pesos pagado en dólares",
          },
        ],
      })
    )
    expect(r.usd.saldo_actual).toBe(5_000)
    expect(r.usd.egresos_comprometidos).toBe(100)
    expect(r.usd.saldo_proyectado).toBe(4_900)
    expect(r.ars.egresos_comprometidos).toBe(0)
  })
})
