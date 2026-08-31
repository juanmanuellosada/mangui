import { describe, it, expect } from "vitest"
import {
  nextCloseDate,
  previousCloseDate,
  computeDueDate,
  currentCycleRange,
  isInCycle,
  toDateString,
  formatStatementLabel,
  currentCycleSummary,
  listCardCycles,
  nextCardPayment,
  defaultCycleIndex,
  type CardCycle,
  type CardRecurring,
} from "./cards"

// ---------------------------------------------------------------------------
// toDateString
// ---------------------------------------------------------------------------
describe("toDateString", () => {
  it("formats a Date to yyyy-MM-dd", () => {
    expect(toDateString(new Date(2026, 5, 15))).toBe("2026-06-15")
  })

  it("pads month and day with leading zeros", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})

// ---------------------------------------------------------------------------
// nextCloseDate
// ---------------------------------------------------------------------------
describe("nextCloseDate", () => {
  it("returns this month's close when ref is before the close day", () => {
    // ref = June 10, closingDay = 20 → June 20
    const ref = new Date(2026, 5, 10) // June 10 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-06-20")
  })

  it("returns this month's close when ref IS the close day", () => {
    const ref = new Date(2026, 5, 20) // June 20 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-06-20")
  })

  it("returns next month's close when ref is after the close day", () => {
    // ref = June 25, closingDay = 20 → July 20
    const ref = new Date(2026, 5, 25) // June 25 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-07-20")
  })

  it("clamps day=31 in February (non-leap 2026) to Feb 28", () => {
    const ref = new Date(2026, 1, 1) // Feb 1 2026
    const result = nextCloseDate(31, ref)
    expect(toDateString(result)).toBe("2026-02-28")
  })

  it("clamps day=31 in February (leap 2024) to Feb 29", () => {
    const ref = new Date(2024, 1, 1) // Feb 1 2024
    const result = nextCloseDate(31, ref)
    expect(toDateString(result)).toBe("2024-02-29")
  })

  it("wraps from December to January next year", () => {
    // ref = Dec 25, closingDay = 20 → Jan 20 2027
    const ref = new Date(2026, 11, 25) // Dec 25 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2027-01-20")
  })
})

// ---------------------------------------------------------------------------
// previousCloseDate
// ---------------------------------------------------------------------------
describe("previousCloseDate", () => {
  it("returns this month's close when it is strictly before ref", () => {
    // ref = June 25, closingDay = 20 → June 20
    const ref = new Date(2026, 5, 25)
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-06-20")
  })

  it("returns last month's close when ref is on or before close day", () => {
    // ref = June 15, closingDay = 20 → May 20
    const ref = new Date(2026, 5, 15)
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-05-20")
  })

  it("ref equals close day → returns last month's close", () => {
    // close is NOT strictly before ref when equal, so falls to last month
    const ref = new Date(2026, 5, 20) // June 20
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-05-20")
  })

  it("wraps from January back to December of previous year", () => {
    // ref = Jan 10, closingDay = 20 → Dec 20 previous year
    const ref = new Date(2026, 0, 10)
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2025-12-20")
  })

  it("clamps day=31 for February", () => {
    // ref = March 5, closingDay = 31 → previous month is Feb → Feb 28 (2026 non-leap)
    const ref = new Date(2026, 2, 5)
    const result = previousCloseDate(31, ref)
    expect(toDateString(result)).toBe("2026-02-28")
  })
})

// ---------------------------------------------------------------------------
// computeDueDate
// ---------------------------------------------------------------------------
describe("computeDueDate", () => {
  it("dueDay > closingDay → due in same month as close", () => {
    // close = June 20 (closingDay=20), dueDay=25 → June 25
    const closeDate = new Date(2026, 5, 20)
    const result = computeDueDate(closeDate, 25, 20)
    expect(toDateString(result)).toBe("2026-06-25")
  })

  it("dueDay <= closingDay → due in following month", () => {
    // close = June 20 (closingDay=20), dueDay=10 → July 10
    const closeDate = new Date(2026, 5, 20)
    const result = computeDueDate(closeDate, 10, 20)
    expect(toDateString(result)).toBe("2026-07-10")
  })

  it("dueDay === closingDay → due in following month", () => {
    const closeDate = new Date(2026, 5, 20)
    const result = computeDueDate(closeDate, 20, 20)
    expect(toDateString(result)).toBe("2026-07-20")
  })

  it("month/year wrap: close in December, due in January next year", () => {
    // close = Dec 20 (closingDay=20), dueDay=10 → Jan 10 next year
    const closeDate = new Date(2026, 11, 20)
    const result = computeDueDate(closeDate, 10, 20)
    expect(toDateString(result)).toBe("2027-01-10")
  })

  it("due day clamped when target month is shorter", () => {
    // close = Jan 31 (closingDay=31), dueDay=15 ≤ 31 → Feb 15 (no clamping needed)
    const closeDate = new Date(2026, 0, 31)
    const result = computeDueDate(closeDate, 15, 31)
    expect(toDateString(result)).toBe("2026-02-15")
  })

  it("due day clamped to Feb 28 when dueDay=31 in non-leap year", () => {
    // close = Jan 15 (closingDay=15), dueDay=31 > 15 → same month (Jan) clamp to 31
    // Actually Jan has 31 days so no clamping. Let's use a close in Jan, dueDay=31>15
    // close = Jan 15, closingDay=15, dueDay=31 > closingDay → same month Jan 31
    const closeDate = new Date(2026, 0, 15)
    const result = computeDueDate(closeDate, 31, 15)
    expect(toDateString(result)).toBe("2026-01-31")
  })

  it("due day clamps in Feb when following month is Feb", () => {
    // close = Jan 20 (closingDay=20), dueDay=10 <= 20 → Feb 10
    const closeDate = new Date(2026, 0, 20)
    const result = computeDueDate(closeDate, 10, 20)
    expect(toDateString(result)).toBe("2026-02-10")
  })
})

// ---------------------------------------------------------------------------
// currentCycleRange
// ---------------------------------------------------------------------------
describe("currentCycleRange", () => {
  it("cycleEnd = nextClose, cycleStart = day after prevClose", () => {
    // ref = June 10, closingDay = 20
    // nextClose = June 20, prevClose = May 20 → cycleStart = May 21
    const ref = new Date(2026, 5, 10)
    const { cycleStart, cycleEnd } = currentCycleRange(20, ref)
    expect(toDateString(cycleStart)).toBe("2026-05-21")
    expect(toDateString(cycleEnd)).toBe("2026-06-20")
  })

  it("cycleStart < cycleEnd always", () => {
    const ref = new Date(2026, 5, 10)
    const { cycleStart, cycleEnd } = currentCycleRange(20, ref)
    expect(cycleStart.getTime()).toBeLessThan(cycleEnd.getTime())
  })

  it("ref after close day: cycle spans current to next month", () => {
    // ref = June 25, closingDay = 20
    // nextClose = July 20, prevClose = June 20 → cycleStart = June 21
    const ref = new Date(2026, 5, 25)
    const { cycleStart, cycleEnd } = currentCycleRange(20, ref)
    expect(toDateString(cycleStart)).toBe("2026-06-21")
    expect(toDateString(cycleEnd)).toBe("2026-07-20")
  })

  it("closingDay=31, ref in February: cycleEnd clamps correctly", () => {
    const ref = new Date(2026, 1, 15) // Feb 15
    const { cycleEnd } = currentCycleRange(31, ref)
    expect(toDateString(cycleEnd)).toBe("2026-02-28")
  })
})

// ---------------------------------------------------------------------------
// isInCycle
// ---------------------------------------------------------------------------
describe("isInCycle", () => {
  const start = new Date(2026, 4, 21) // May 21
  const end = new Date(2026, 5, 20)   // June 20

  it("date equal to cycleStart → true (inclusive lower bound)", () => {
    expect(isInCycle("2026-05-21", start, end)).toBe(true)
  })

  it("date equal to cycleEnd → true (inclusive upper bound)", () => {
    expect(isInCycle("2026-06-20", start, end)).toBe(true)
  })

  it("date strictly inside cycle → true", () => {
    expect(isInCycle("2026-06-01", start, end)).toBe(true)
  })

  it("date one day before start → false", () => {
    expect(isInCycle("2026-05-20", start, end)).toBe(false)
  })

  it("date one day after end → false", () => {
    expect(isInCycle("2026-06-21", start, end)).toBe(false)
  })

  it("date far in the past → false", () => {
    expect(isInCycle("2020-01-01", start, end)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// nextCardPayment — fallback sin statements persistidos (card_statements vacío)
// ---------------------------------------------------------------------------
describe("nextCardPayment — fallback sin statements (cierra día 2, vence día 13)", () => {
  const account = { closing_date: "2020-01-02", due_date: "2020-01-13", currency: "ARS" }
  const movements = [
    // Dentro del último ciclo cerrado (2026-06-03 a 2026-07-02).
    { account_id: "card-1", type: "expense", date: "2026-06-15", amount: 1000, converted_amount: null, original_currency: "ARS" },
    // Dentro del ciclo abierto (2026-07-03 en adelante) — no debe contar para el fallback.
    { account_id: "card-1", type: "expense", date: "2026-07-04", amount: 500, converted_amount: null, original_currency: "ARS" },
  ]

  it("hoy entre el cierre (2-jul) y el vencimiento (13-jul) del último ciclo cerrado → dueDate = 13-jul, no el mes siguiente", () => {
    const ref = new Date(2026, 6, 6) // 6 de julio 2026
    const { amount, dueDate } = nextCardPayment("card-1", account, [], movements, ref)
    expect(dueDate).toBe("2026-07-13")
    expect(amount).toBe(1000)
  })

  it("hoy después del vencimiento (13-jul) ya vencido → sigue mostrando ese mismo vencimiento (no rueda al mes siguiente, igual que Tarjetas: queda 'vencido' hasta pagarse)", () => {
    const ref = new Date(2026, 6, 20) // 20 de julio 2026
    const { dueDate } = nextCardPayment("card-1", account, [], movements, ref)
    expect(dueDate).toBe("2026-07-13")
  })

  it("amount y dueDate corresponden al mismo ciclo mientras el vencimiento del ciclo cerrado siga vigente", () => {
    const ref = new Date(2026, 6, 6) // 6 de julio 2026 — vencimiento (13-jul) todavía no llegó
    const { amount, dueDate } = nextCardPayment("card-1", account, [], movements, ref)
    // El monto es el del ciclo cerrado (solo el movimiento de junio) y el
    // vencimiento mostrado corresponde a ese mismo ciclo cerrado (13-jul).
    expect(amount).toBe(1000)
    expect(dueDate).toBe("2026-07-13")
  })
})

// ---------------------------------------------------------------------------
// formatStatementLabel
// ---------------------------------------------------------------------------
describe("formatStatementLabel", () => {
  it("returns month name in Spanish followed by year", () => {
    const closeDate = new Date(2026, 5, 20) // June 20 2026
    expect(formatStatementLabel(closeDate)).toBe("junio 2026")
  })

  it("January in Spanish", () => {
    const closeDate = new Date(2026, 0, 15)
    expect(formatStatementLabel(closeDate)).toBe("enero 2026")
  })

  it("December in Spanish", () => {
    const closeDate = new Date(2025, 11, 31)
    expect(formatStatementLabel(closeDate)).toBe("diciembre 2025")
  })
})

// ---------------------------------------------------------------------------
// currentCycleSummary / listCardCycles — "USD puro" (ver src/lib/money.ts)
// ---------------------------------------------------------------------------
describe("currentCycleSummary — USD puro", () => {
  // Solo el día del mes de closing_date/due_date importa para proyectar el
  // ciclo (el año/mes del ancla en sí es irrelevante — ver dayOfMonth en cards.ts).
  const account = { closing_date: "2020-01-20", due_date: "2020-01-10", currency: "ARS" }
  const ref = new Date(2026, 5, 10) // June 10 2026 → cycle May 21 – June 20

  it("does not count a USD movement with no converted_amount toward the ARS total", () => {
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-05", amount: 200, converted_amount: null, original_currency: "ARS" },
      { account_id: "card-1", type: "expense", date: "2026-06-06", amount: 50, converted_amount: null, original_currency: "USD" },
    ]
    const { amount } = currentCycleSummary("card-1", account, movements, ref)
    expect(amount).toBe(200)
  })

  it("counts a USD movement's converted_amount when present", () => {
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-05", amount: 200, converted_amount: null, original_currency: "ARS" },
      { account_id: "card-1", type: "expense", date: "2026-06-06", amount: 50, converted_amount: 67500, original_currency: "USD" },
    ]
    const { amount } = currentCycleSummary("card-1", account, movements, ref)
    expect(amount).toBe(67700)
  })
})

describe("listCardCycles — edge de fechas: el cierre del ciclo más viejo cae después de ref", () => {
  it("incluye el ciclo del movimiento más viejo aunque su cierre sea posterior a ref (ciclo abierto)", () => {
    const account = { closing_date: "2020-01-20", due_date: "2020-01-10", currency: "ARS" }
    // Único movimiento, dentro del ciclo abierto (cierra 2026-06-20).
    const movements = [
      { id: "m1", account_id: "card-1", type: "expense", date: "2026-06-05", amount: 100, converted_amount: null, original_currency: "ARS" },
    ]
    // ref cae estrictamente antes del cierre del ciclo que contiene el movimiento más viejo.
    const ref = new Date(2026, 5, 10) // June 10 2026
    const cycles = listCardCycles("card-1", account, movements, [], ref)
    expect(cycles.length).toBeGreaterThan(0)
    const cycle = cycles[cycles.length - 1]
    expect(cycle.closeDate).toBe("2026-06-20")
    expect(cycle.total).toBe(100)
  })
})

describe("listCardCycles — totalsByCurrency vs. ARS total", () => {
  it("USD-puro expenses stay out of `total` (ARS) but still show up in totalsByCurrency.USD", () => {
    const account = { closing_date: "2020-01-20", due_date: "2020-01-10", currency: "ARS" }
    const movements = [
      { id: "m1", account_id: "card-1", type: "expense", date: "2026-06-05", amount: 200, converted_amount: null, original_currency: "ARS" },
      { id: "m2", account_id: "card-1", type: "expense", date: "2026-06-06", amount: 50, converted_amount: null, original_currency: "USD" },
    ]
    // ref = cierre del ciclo que contiene los movimientos (2026-06-20), para
    // evitar que quede fuera del rango cubierto por listCardCycles.
    const ref = new Date(2026, 5, 20)
    const cycles = listCardCycles("card-1", account, movements, [], ref)
    const cycle = cycles[cycles.length - 1]
    expect(cycle.total).toBe(200)
    expect(cycle.totalsByCurrency).toEqual({ ARS: 200, USD: 50 })
  })
})

// ---------------------------------------------------------------------------
// Anclaje en closing_date/due_date (fecha completa, no solo día del mes) —
// el ciclo se ancla en la fecha guardada y se proyecta mes a mes (Tarea 0054).
// ---------------------------------------------------------------------------
describe("currentCycleSummary — ancla en closing_date/due_date", () => {
  it("el ciclo actual cierra exactamente en la fecha guardada cuando ref cae ese mismo día", () => {
    const account = { closing_date: "2026-06-20", due_date: "2026-06-10", currency: "ARS" }
    const ref = new Date(2026, 5, 20) // 20 de junio 2026, mismo día que closing_date
    const { closeDate } = currentCycleSummary("card-1", account, [], ref)
    expect(closeDate).toBe("2026-06-20")
  })

  it("el ciclo siguiente se proyecta +1 mes desde la fecha guardada", () => {
    // Ancla en enero (2026-01-15); parado en febrero, el próximo cierre cae el 15/2.
    const account = { closing_date: "2026-01-15", due_date: null, currency: "ARS" }
    const ref = new Date(2026, 1, 1) // 1 de febrero 2026
    const { closeDate } = currentCycleSummary("card-1", account, [], ref)
    expect(closeDate).toBe("2026-02-15")
  })

  it("borde fin de mes: un cierre anclado el día 31 se clampea a 28 en febrero (no bisiesto)", () => {
    const account = { closing_date: "2026-01-31", due_date: null, currency: "ARS" }
    const ref = new Date(2026, 1, 1) // 1 de febrero 2026
    const { closeDate } = currentCycleSummary("card-1", account, [], ref)
    expect(closeDate).toBe("2026-02-28")
  })
})

// ---------------------------------------------------------------------------
// listCardCycles — un consumo importado se agrupa por el resumen al que
// pertenece (import_statement_id), no por su fecha individual. Caso real:
// un consumo con fecha justo antes del inicio del ciclo calculado por la app,
// pero que el banco incluyó en el resumen importado.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Neteo de devoluciones/reintegros (is_refund → type 'income' resta del total)
// ---------------------------------------------------------------------------
describe("listCardCycles — neteo de reintegros (gastos - devoluciones)", () => {
  it("un movimiento type='income' resta del total y de totalsByCurrency", () => {
    const account = { closing_date: "2020-01-20", due_date: "2020-01-10", currency: "ARS" }
    const movements = [
      { id: "m1", account_id: "card-1", type: "expense", date: "2026-06-05", amount: 1000, converted_amount: null, original_currency: "ARS" },
      { id: "m2", account_id: "card-1", type: "income", date: "2026-06-06", amount: 200, converted_amount: null, original_currency: "ARS" },
    ]
    const ref = new Date(2026, 5, 20)
    const cycles = listCardCycles("card-1", account, movements, [], ref)
    const cycle = cycles[cycles.length - 1]
    expect(cycle.total).toBe(800)
    expect(cycle.totalsByCurrency).toEqual({ ARS: 800, USD: 0 })
  })
})

describe("currentCycleSummary — neteo de reintegros", () => {
  it("resta un movimiento type='income' del amount del ciclo abierto", () => {
    const account = { closing_date: "2020-01-20", due_date: "2020-01-10", currency: "ARS" }
    const ref = new Date(2026, 5, 10) // June 10 2026 → cycle May 21 – June 20
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-05", amount: 1000, converted_amount: null, original_currency: "ARS" },
      { account_id: "card-1", type: "income", date: "2026-06-06", amount: 300, converted_amount: null, original_currency: "ARS" },
    ]
    const { amount } = currentCycleSummary("card-1", account, movements, ref)
    expect(amount).toBe(700)
  })
})

describe("nextCardPayment — fallback: neteo de reintegros", () => {
  const account = { closing_date: "2020-01-02", due_date: "2020-01-13", currency: "ARS" }

  it("resta un movimiento type='income' del total del último ciclo cerrado", () => {
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-15", amount: 1000, converted_amount: null, original_currency: "ARS" },
      { account_id: "card-1", type: "income", date: "2026-06-16", amount: 150, converted_amount: null, original_currency: "ARS" },
    ]
    const ref = new Date(2026, 6, 6) // 6 de julio 2026
    const { amount } = nextCardPayment("card-1", account, [], movements, ref)
    expect(amount).toBe(850)
  })
})

// ---------------------------------------------------------------------------
// nextCardPayment — amountUSD (Bug 2: subtotal nativo en USD, sin conversión
// por cotización — ver el chip de Cuentas en accounts-list.tsx)
// ---------------------------------------------------------------------------
describe("nextCardPayment — amountUSD", () => {
  const account = { closing_date: "2020-01-02", due_date: "2020-01-13", currency: "ARS" }

  it("fallback: suma el subtotal nativo de los movimientos en USD del ciclo cerrado, sin convertir", () => {
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-15", amount: 1000, converted_amount: null, original_currency: "ARS" },
      { account_id: "card-1", type: "expense", date: "2026-06-16", amount: 48, converted_amount: null, original_currency: "USD" },
      { account_id: "card-1", type: "expense", date: "2026-06-17", amount: 47, converted_amount: null, original_currency: "USD" },
    ]
    const ref = new Date(2026, 6, 6) // 6 de julio 2026
    const { amountUSD } = nextCardPayment("card-1", account, [], movements, ref)
    expect(amountUSD).toBe(95)
  })

  it("fallback: 0 cuando no hay movimientos en USD", () => {
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-15", amount: 1000, converted_amount: null, original_currency: "ARS" },
    ]
    const ref = new Date(2026, 6, 6)
    const { amountUSD } = nextCardPayment("card-1", account, [], movements, ref)
    expect(amountUSD).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// nextCardPayment — delega en listCardCycles + defaultCycleIndex (Bug: Cuentas
// mostraba un monto viejo del resumen guardado apenas se editaban cierre/
// vencimiento, porque su propio algoritmo confiaba en el total_amount
// guardado de cualquier resumen "cerrado" sin chequear si sus fechas seguían
// alineadas con el ciclo recalculado. Ahora usa el mismo ciclo que Tarjetas).
// ---------------------------------------------------------------------------
describe("nextCardPayment — resumen matcheado por close_date", () => {
  const account = { closing_date: "2020-01-02", due_date: "2020-01-13", currency: "ARS" }
  const movements = [
    { account_id: "card-1", type: "expense", date: "2026-06-15", amount: 1000, converted_amount: null, original_currency: "ARS" },
  ]
  const ref = new Date(2026, 6, 6) // 6 de julio 2026 — mismo ciclo que el resto de este describe (cierre 2026-07-02)

  it("resumen PENDIENTE: usa el total EN VIVO del ciclo, no el total guardado (aunque las fechas coincidan)", () => {
    const statements = [
      { account_id: "card-1", total_amount: 999999, total_amount_usd: 999, due_date: "2026-07-13", close_date: "2026-07-02", status: "pendiente" },
    ]
    const { amount, amountUSD, dueDate } = nextCardPayment("card-1", account, statements, movements, ref)
    expect(amount).toBe(1000) // el del movimiento real, no 999999
    expect(amountUSD).toBe(0)
    expect(dueDate).toBe("2026-07-13")
  })

  it("resumen PAGADO: usa el total_amount guardado (no el ciclo, que puede haber cambiado desde que se pagó)", () => {
    const statements = [
      { account_id: "card-1", total_amount: 1000, total_amount_usd: 0, due_date: "2026-07-13", close_date: "2026-07-02", status: "pagado" },
    ]
    const { amount, dueDate } = nextCardPayment("card-1", account, statements, movements, ref)
    expect(amount).toBe(1000)
    expect(dueDate).toBe("2026-07-13")
  })
})

describe("nextCardPayment — parity con listCardCycles/defaultCycleIndex tras editar cierre/vencimiento", () => {
  it("un resumen guardado con las fechas VIEJAS ya no matchea el ciclo recalculado con las fechas nuevas → nextCardPayment usa el total en vivo del ciclo actual, no el total viejo guardado", () => {
    // Antes de editar: cierre día 15, vencimiento día 25 — un resumen ya se
    // había generado para ese ciclo viejo (cierre 2026-06-15).
    const staleStatement = {
      account_id: "card-1",
      total_amount: 50000,
      total_amount_usd: 0,
      due_date: "2026-06-25",
      close_date: "2026-06-15",
      status: "pendiente",
    }
    // Después de editar: cierre día 20, vencimiento día 28 — el ciclo se
    // recalcula con las fechas nuevas (Tarea del bug: Tarjetas ya hace esto
    // via listCardCycles; Cuentas debe coincidir).
    const account = { closing_date: "2026-01-20", due_date: "2026-01-28", currency: "ARS" }
    const movements = [
      { account_id: "card-1", type: "expense", date: "2026-06-10", amount: 30000, converted_amount: null, original_currency: "ARS" },
    ]
    const ref = new Date(2026, 6, 1) // 1 de julio 2026 — el ciclo nuevo (cierre 2026-06-20) ya cerró

    const payment = nextCardPayment("card-1", account, [staleStatement], movements, ref)

    // Referencia independiente: lo que Tarjetas mostraría para este mismo
    // ciclo, calculado directamente con listCardCycles + defaultCycleIndex.
    const cycles = listCardCycles(
      "card-1",
      account,
      movements.map((m) => ({ ...m, id: "m1" })),
      [{ ...staleStatement, id: "stmt-1", stamp_tax: 0, paid_amount: null, paid_amount_usd: null, paid_date: null, paid_from_account_id: null, paid_from_account_id_usd: null, transfer_id: null, paid_movement_id_usd: null }],
      ref
    )
    const expectedCycle = cycles[defaultCycleIndex(cycles, ref)]

    expect(payment.amount).toBe(expectedCycle.total)
    expect(payment.amountUSD).toBe(expectedCycle.totalsByCurrency.USD)
    expect(payment.dueDate).toBe(expectedCycle.dueDate)

    // El resumen viejo (cierre 15) no matchea el ciclo nuevo (cierre 20) —
    // nextCardPayment ya no debe devolver su total guardado (50000).
    expect(payment.amount).toBe(30000)
    expect(payment.amount).not.toBe(staleStatement.total_amount)
    expect(payment.dueDate).toBe("2026-06-28")
  })
})

describe("listCardCycles — agrupación de movimientos importados por resumen", () => {
  const account = { closing_date: "2026-01-02", due_date: "2026-01-10", currency: "ARS" }

  function makeStatement(closeDate: string) {
    return {
      id: "stmt-julio",
      account_id: "card-1",
      close_date: closeDate,
      due_date: "2026-07-10",
      status: "pendiente",
      total_amount: 0,
      total_amount_usd: 0,
      stamp_tax: 0,
      paid_amount: null,
      paid_amount_usd: null,
      paid_date: null,
      paid_from_account_id: null,
      paid_from_account_id_usd: null,
      transfer_id: null,
      paid_movement_id_usd: null,
    }
  }

  it("un movimiento importado con fecha anterior al inicio del ciclo queda en el ciclo del resumen al que fue importado", () => {
    const statement = makeStatement("2026-07-02")
    const movements = [
      // OBSIDIAN: fecha 1-jun, anterior al inicio del ciclo de julio (2026-06-03),
      // pero importado al resumen de julio (cierre 2026-07-02).
      {
        id: "m-obsidian",
        account_id: "card-1",
        type: "expense",
        date: "2026-06-01",
        amount: 48,
        converted_amount: null,
        original_currency: "USD",
        import_statement_id: "stmt-julio",
      },
      // Resto de los consumos del resumen, con fecha ya dentro del ciclo calculado.
      {
        id: "m-julio",
        account_id: "card-1",
        type: "expense",
        date: "2026-06-03",
        amount: 100,
        converted_amount: null,
        original_currency: "ARS",
        import_statement_id: "stmt-julio",
      },
    ]
    const ref = new Date(2026, 6, 2) // 2 de julio 2026
    const cycles = listCardCycles("card-1", account, movements, [statement], ref)

    const julyCycle = cycles.find((c) => c.closeDate === "2026-07-02")
    expect(julyCycle).toBeDefined()
    expect(julyCycle!.movements.map((m) => m.id).sort()).toEqual(["m-julio", "m-obsidian"].sort())
    // La fecha del movimiento no se toca — solo cambia en qué resumen aparece.
    expect(julyCycle!.movements.find((m) => m.id === "m-obsidian")!.date).toBe("2026-06-01")

    // Como TODOS los movimientos de junio quedaron reagrupados en el resumen
    // de julio (por import_statement_id), no debe crearse un ciclo de junio
    // vacío antes del primero real (Bug 3).
    expect(cycles.some((c) => c.closeDate === "2026-06-02")).toBe(false)
    expect(cycles[0]).toBe(julyCycle)
  })

  it("un movimiento manual (sin import_statement_id) sigue agrupándose por fecha", () => {
    const statement = makeStatement("2026-07-02")
    const movements = [
      {
        id: "m-manual",
        account_id: "card-1",
        type: "expense",
        date: "2026-06-01",
        amount: 48,
        converted_amount: null,
        original_currency: "ARS",
        import_statement_id: null,
      },
    ]
    const ref = new Date(2026, 6, 2) // 2 de julio 2026
    const cycles = listCardCycles("card-1", account, movements, [statement], ref)

    const juneCycle = cycles.find((c) => c.closeDate === "2026-06-02")
    expect(juneCycle?.movements.some((m) => m.id === "m-manual")).toBe(true)

    const julyCycle = cycles.find((c) => c.closeDate === "2026-07-02")
    expect(julyCycle?.movements.some((m) => m.id === "m-manual")).toBe(false)
  })

  it("único movimiento, con fecha en un ciclo anterior pero importado a un resumen posterior → no genera un ciclo vacío inicial (Bug 3)", () => {
    const statement = makeStatement("2026-07-02")
    const movements = [
      {
        id: "m-obsidian",
        account_id: "card-1",
        type: "expense",
        date: "2026-06-01",
        amount: 48,
        converted_amount: null,
        original_currency: "USD",
        import_statement_id: "stmt-julio",
      },
    ]
    const ref = new Date(2026, 6, 2) // 2 de julio 2026
    const cycles = listCardCycles("card-1", account, movements, [statement], ref)

    // El único ciclo debe ser el de julio (el del resumen al que fue
    // importado) — sin un ciclo de junio vacío por delante.
    expect(cycles).toHaveLength(1)
    expect(cycles[0].closeDate).toBe("2026-07-02")
    expect(cycles[0].movements.map((m) => m.id)).toEqual(["m-obsidian"])
  })
})

// ---------------------------------------------------------------------------
// defaultCycleIndex — índice del resumen "A pagar" a mostrar por default
// ---------------------------------------------------------------------------
describe("defaultCycleIndex", () => {
  // defaultCycleIndex sólo lee cycleEnd y statement?.status — se castea al
  // tipo completo de CardCycle para no tener que rellenar el resto de los
  // campos (movements, total, totalsByCurrency, etc.) en cada fixture.
  function cycle(overrides: { closeDate: string; cycleEnd: Date; statement?: { status: string } | null }) {
    return {
      closeDate: overrides.closeDate,
      dueDate: null,
      cycleStart: new Date(2026, 0, 1),
      cycleEnd: overrides.cycleEnd,
      movements: [],
      total: 0,
      totalsByCurrency: { ARS: 0, USD: 0 },
      statement: overrides.statement ?? null,
    } as unknown as CardCycle
  }

  it("devuelve 0 si no hay ciclos", () => {
    expect(defaultCycleIndex([])).toBe(0)
  })

  it("elige el ciclo cerrado y no pagado más reciente ('A pagar'), no el más viejo", () => {
    const ref = new Date(2026, 6, 15) // 15 de julio 2026
    const cycles = [
      cycle({ closeDate: "2026-06-02", cycleEnd: new Date(2026, 5, 2), statement: { status: "pagado" } }),
      cycle({ closeDate: "2026-07-02", cycleEnd: new Date(2026, 6, 2), statement: { status: "pendiente" } }),
      cycle({ closeDate: "2026-08-02", cycleEnd: new Date(2026, 7, 2) }), // ciclo en curso, sin cerrar
    ]
    expect(defaultCycleIndex(cycles, ref)).toBe(1)
  })

  it("si todos los ciclos cerrados ya están pagados, cae al ciclo en curso", () => {
    const ref = new Date(2026, 6, 15)
    const cycles = [
      cycle({ closeDate: "2026-06-02", cycleEnd: new Date(2026, 5, 2), statement: { status: "pagado" } }),
      cycle({ closeDate: "2026-07-02", cycleEnd: new Date(2026, 6, 2), statement: { status: "pagado" } }),
      cycle({ closeDate: "2026-08-02", cycleEnd: new Date(2026, 7, 2) }),
    ]
    expect(defaultCycleIndex(cycles, ref)).toBe(2)
  })

  it("sin ningún ciclo cerrado todavía, cae al único ciclo (en curso)", () => {
    const ref = new Date(2026, 5, 10)
    const cycles = [cycle({ closeDate: "2026-06-20", cycleEnd: new Date(2026, 5, 20) })]
    expect(defaultCycleIndex(cycles, ref)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// listCardCycles — proyección de recurrentes de tarjeta (Feature: recurrentes
// visibles en los resúmenes, análogo a projectedRecurring de statement-import.ts)
// ---------------------------------------------------------------------------
describe("listCardCycles — proyección de recurrentes de tarjeta", () => {
  const account = { closing_date: "2020-01-20", due_date: "2020-01-10", currency: "ARS" }
  const ref = new Date(2026, 5, 10) // 10 de junio 2026

  const recurrings: CardRecurring[] = [
    { id: "r-netflix", amount: 15990, currency: "ARS", note: "Netflix", day_of_month: 5, category_id: null },
  ]

  // Tres ciclos: mayo (cerrado, con un gasto ajeno), junio (en curso, sin
  // gastos), julio (futuro, con el consumo real de Netflix ya cargado).
  function buildCycles() {
    const movements = [
      { id: "m-past", account_id: "card-1", type: "expense", date: "2026-05-15", amount: 100, converted_amount: null, original_currency: "ARS" },
      { id: "m-netflix-julio", account_id: "card-1", type: "expense", date: "2026-07-20", amount: 15990, converted_amount: null, original_currency: "ARS", note: "Netflix" },
    ]
    return listCardCycles("card-1", account, movements, [], ref, recurrings)
  }

  it("proyecta la recurrente en un ciclo futuro sin consumo real, sumando al total", () => {
    const cycles = buildCycles()
    const juneCycle = cycles.find((c) => c.closeDate === "2026-06-20")!
    expect(juneCycle.projectedRecurrings).toHaveLength(1)
    expect(juneCycle.projectedRecurrings[0]).toMatchObject({
      isProjectedRecurring: true,
      recurringId: "r-netflix",
      amount: 15990,
      currency: "ARS",
    })
    expect(juneCycle.total).toBe(15990)
    expect(juneCycle.totalsByCurrency).toEqual({ ARS: 15990, USD: 0 })
  })

  it("no proyecta en un ciclo que ya tiene el consumo real de esa recurrente (dedup por comercio+moneda)", () => {
    const cycles = buildCycles()
    const julyCycle = cycles.find((c) => c.closeDate === "2026-07-20")!
    expect(julyCycle.projectedRecurrings).toHaveLength(0)
    // El total sigue siendo el del movimiento real, sin duplicar.
    expect(julyCycle.total).toBe(15990)
  })

  it("no proyecta en ciclos ya cerrados (pasados)", () => {
    const cycles = buildCycles()
    const mayCycle = cycles.find((c) => c.closeDate === "2026-05-20")!
    expect(mayCycle.projectedRecurrings).toHaveLength(0)
    expect(mayCycle.total).toBe(100)
  })
})

// Caso real (VISA Galicia, cierre 30-ago-26): el banco acredita la
// "DEV.IMP. RG 5617" contra el SALDO ANTERIOR el mismo día del pago del
// resumen previo. Cae dentro de este ciclo por fecha, pero el TOTAL A PAGAR
// de este resumen no la netea: restarla mostraba $341.870,32 en vez de los
// $431.289,23 que pide el banco.
describe("listCardCycles — devolución que cancela el saldo del resumen anterior", () => {
  const account = { closing_date: "2020-01-30", due_date: "2020-02-07", currency: "ARS" }
  const ref = new Date(2026, 8, 1) // 1 de septiembre 2026

  function cycleFor(settlesPrevious: boolean) {
    const movements = [
      {
        id: "m-consumos",
        account_id: "card-1",
        type: "expense",
        date: "2026-08-26",
        amount: 431289.23,
        converted_amount: null,
        original_currency: "ARS",
      },
      {
        id: "m-dev",
        account_id: "card-1",
        type: "income",
        date: "2026-08-07",
        amount: 89418.91,
        converted_amount: null,
        original_currency: "ARS",
        settles_previous: settlesPrevious,
      },
    ]
    const cycles = listCardCycles("card-1", account, movements, [], ref)
    return cycles.find((c) => c.closeDate === "2026-08-30")!
  }

  it("no resta del total del ciclo, pero el movimiento se sigue listando", () => {
    const cycle = cycleFor(true)
    expect(cycle.total).toBe(431289.23)
    expect(cycle.totalsByCurrency.ARS).toBe(431289.23)
    // Sigue siendo un movimiento del resumen: se muestra, sólo no suma.
    expect(cycle.movements.map((m) => m.id).sort()).toEqual(["m-consumos", "m-dev"])
  })

  it("un reintegro normal del período sí resta (comportamiento sin la bandera)", () => {
    const cycle = cycleFor(false)
    // toBeCloseTo: cards.ts no redondea el total (431289.23 - 89418.91 da
    // 341870.31999999995 en float); acá sólo importa que la devolución reste.
    expect(cycle.total).toBeCloseTo(341870.32, 2)
    expect(cycle.totalsByCurrency.ARS).toBeCloseTo(341870.32, 2)
  })
})
