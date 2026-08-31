import { describe, it, expect } from "vitest"
import {
  reconcileStatement,
  buildReconcileApplyPayload,
  buildReconcilePlan,
  type ReconcileMovement,
} from "./statement-reconcile"
import type { ParsedStatement, ParsedStatementLine } from "./ai/statement-schema"
import type { StatementReviewLine } from "./statement-import"

function makeLine(overrides: Partial<ParsedStatementLine> = {}): ParsedStatementLine {
  return {
    description: "Super Chino",
    date: "2026-06-15",
    amount: 5000,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    is_subscription: false,
    is_refund: false,
    settles_previous: false,
    category_hint: null,
    ...overrides,
  }
}

function makeParsed(lines: ParsedStatementLine[]): ParsedStatement {
  return {
    bank: null,
    account_idx: null,
    account_hint: null,
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_ars: null,
    total_usd: null,
    stamp_tax: null,
    lines,
    upcoming_installments: null,
  }
}

function makeMovement(overrides: Partial<ReconcileMovement> = {}): ReconcileMovement {
  return {
    id: "mov-1",
    description: "Super Chino",
    amount: 5000,
    currency: "ARS",
    type: "expense",
    installment_number: null,
    installment_total: null,
    ...overrides,
  }
}

describe("reconcileStatement", () => {
  it("no reporta nada cuando la línea del PDF y el movimiento cargado coinciden exacto", () => {
    const result = reconcileStatement(makeParsed([makeLine()]), [makeMovement()])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("caso falta: línea del PDF sin movimiento cargado equivalente", () => {
    const line = makeLine({ description: "Kiosco Don Pepe", amount: 1200 })
    const result = reconcileStatement(makeParsed([line]), [])
    expect(result.missing).toEqual([line])
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("caso sobra: movimiento cargado sin línea equivalente en el PDF", () => {
    const movement = makeMovement({ description: "Farmacity", amount: 800 })
    const result = reconcileStatement(makeParsed([]), [movement])
    expect(result.extra).toEqual([movement])
    expect(result.missing).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("caso diferencia de monto: mismo comercio, importe distinto en el PDF vs cargado", () => {
    const line = makeLine({ description: "Super Chino", amount: 5500 })
    const movement = makeMovement({ description: "Super Chino", amount: 5000 })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toEqual([{ line, movement }])
  })

  it("no marca diferencia de monto por ruido de precisión de floats (tolerancia de centavos)", () => {
    const line = makeLine({ amount: 0.1 + 0.2 }) // 0.30000000000000004
    const movement = makeMovement({ amount: 0.3 })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.mismatched).toHaveLength(0)
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
  })

  it("matchea comercios con la MISMA normalización aunque la descripción varíe levemente", () => {
    // "Super Chino Once" -> normalizeNote quita mayúsculas/puntuación -> extractKeyword
    // toma la primera palabra >=3 chars ("super") por tener más de 2 palabras.
    const line = makeLine({ description: "SUPER CHINO ONCE" })
    const movement = makeMovement({ description: "Super Chino - Sucursal Once" })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("documenta que descripciones muy distintas del MISMO comercio real no matchean (limitación conocida)", () => {
    // "ANTHROPIC* CLAUD" y "CLAUDE.AI SUBSCR" son el mismo comercio real, pero
    // normalizeNote/extractKeyword (rules.ts) las reduce a keywords distintas
    // ("anthropic claud" vs "claude subscr"): la normalización actual no tiene
    // sinónimos ni fuzzy-matching, así que el diff las trata como comercios
    // distintos. Queda documentado a propósito (ver design.md, Risks): el
    // humano revisa el diff y decide, no se auto-resuelve.
    const line = makeLine({ description: "ANTHROPIC* CLAUD", amount: 9900 })
    const movement = makeMovement({ description: "CLAUDE.AI SUBSCR", amount: 9900 })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toEqual([line])
    expect(result.extra).toEqual([movement])
    expect(result.mismatched).toHaveLength(0)
  })

  it("líneas en USD matchean por moneda: no confunde un ARS y un USD del mismo comercio/monto", () => {
    const lineUsd = makeLine({ description: "Netflix", amount: 15, currency: "USD" })
    const movementArs = makeMovement({ description: "Netflix", amount: 15, currency: "ARS" })
    const result = reconcileStatement(makeParsed([lineUsd]), [movementArs])
    expect(result.missing).toEqual([lineUsd])
    expect(result.extra).toEqual([movementArs])
    expect(result.mismatched).toHaveLength(0)

    const movementUsd = makeMovement({ description: "Netflix", amount: 15, currency: "USD" })
    const matched = reconcileStatement(makeParsed([lineUsd]), [movementUsd])
    expect(matched.missing).toHaveLength(0)
    expect(matched.extra).toHaveLength(0)
    expect(matched.mismatched).toHaveLength(0)
  })

  it("cuotas matchean por comercio + número de cuota, no por importe exacto en el mismatch", () => {
    const line = makeLine({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const movement = makeMovement({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("cuotas del mismo comercio pero distinto número de cuota NO matchean entre sí", () => {
    const line = makeLine({
      description: "Notebook",
      amount: 10000,
      installment_number: 4,
      installment_total: 12,
    })
    const movement = makeMovement({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toEqual([line])
    expect(result.extra).toEqual([movement])
    expect(result.mismatched).toHaveLength(0)
  })

  it("cuota con importe distinto en el PDF vs lo cargado queda como diferencia de monto", () => {
    const line = makeLine({
      description: "Notebook",
      amount: 10500,
      installment_number: 3,
      installment_total: 12,
    })
    const movement = makeMovement({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.mismatched).toEqual([{ line, movement }])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
  })

  it("una devolución (is_refund) no matchea contra un gasto del mismo comercio/importe", () => {
    const refundLine = makeLine({ description: "Impuesto Pais", amount: 500, is_refund: true })
    const expenseMovement = makeMovement({ description: "Impuesto Pais", amount: 500, type: "expense" })
    const result = reconcileStatement(makeParsed([refundLine]), [expenseMovement])
    expect(result.missing).toEqual([refundLine])
    expect(result.extra).toEqual([expenseMovement])

    const incomeMovement = makeMovement({ description: "Impuesto Pais", amount: 500, type: "income" })
    const matched = reconcileStatement(makeParsed([refundLine]), [incomeMovement])
    expect(matched.missing).toHaveLength(0)
    expect(matched.extra).toHaveLength(0)
    expect(matched.mismatched).toHaveLength(0)
  })

  it("matchea de a uno cuando hay varias líneas/movimientos con la misma clave (multiset)", () => {
    const lineA = makeLine({ description: "Kiosco", amount: 100 })
    const lineB = makeLine({ description: "Kiosco", amount: 200 })
    const movementA = makeMovement({ id: "mov-a", description: "Kiosco", amount: 100 })
    const result = reconcileStatement(makeParsed([lineA, lineB]), [movementA])
    // lineA matchea exacto con movementA; lineB queda sin movimiento -> falta.
    expect(result.missing).toEqual([lineB])
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })
})

function makeReviewLine(overrides: Partial<StatementReviewLine> = {}): StatementReviewLine {
  return {
    description: "Kiosco Don Pepe",
    date: "2026-06-15",
    amount: 1200,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    is_subscription: false,
    category_id: "cat-1",
    selected: true,
    ...overrides,
  }
}

describe("buildReconcileApplyPayload", () => {
  const baseInput = {
    account_id: "acc-1",
    account_currency: "ARS" as const,
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_amount: 1200,
    total_amount_usd: 0,
    stamp_tax: 0,
  }

  it("marca el payload como additive: true", () => {
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [makeReviewLine()] })
    expect(payload.additive).toBe(true)
  })

  it("solo incluye las líneas tildadas (no agrega nada de más)", () => {
    const kiosco = makeReviewLine({ description: "Kiosco Don Pepe", amount: 1200 })
    const farmacity = makeReviewLine({ description: "Farmacity", amount: 800 })
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [kiosco, farmacity] })
    expect(payload.lines).toHaveLength(2)
    expect(payload.lines.map((l) => l.note)).toEqual(["Kiosco Don Pepe", "Farmacity"])
  })

  it("una línea deseleccionada por el usuario no llega al payload", () => {
    const kiosco = makeReviewLine({ description: "Kiosco Don Pepe" })
    const noTildada = makeReviewLine({ description: "Farmacity", selected: false })
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [kiosco, noTildada] })
    expect(payload.lines).toHaveLength(1)
    expect(payload.lines[0].note).toBe("Kiosco Don Pepe")
  })

  it("una cuota faltante tildada agrega también sus cuotas futuras (misma proyección que el import)", () => {
    const cuota = makeReviewLine({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 5,
    })
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [cuota] })
    expect(payload.lines).toHaveLength(0)
    expect(payload.installment_purchases).toHaveLength(1)
    // Cuotas 3, 4 y 5 (la leída + las futuras hasta el total).
    expect(payload.installment_purchases[0].installments.map((i) => i.installment_number)).toEqual([3, 4, 5])
  })

  it("no muta las líneas de entrada ni recalcula matching (delega toda la expansión a buildStatementPayload)", () => {
    const line = makeReviewLine()
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [line] })
    expect(line.selected).toBe(true) // sigue intacta
    expect(payload.account_id).toBe("acc-1")
    expect(payload.close_date).toBe("2026-06-20")
  })
})

describe("buildReconcileApplyPayload · bajas y correcciones (migración 0059)", () => {
  const base = {
    account_id: "acc-1",
    account_currency: "ARS" as const,
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_amount: 0,
    total_amount_usd: 0,
    stamp_tax: 0,
    linesToApply: [],
  }

  it("sin bajas ni correcciones manda arrays vacíos (no borra ni toca nada)", () => {
    const payload = buildReconcileApplyPayload(base)
    expect(payload.deletions).toEqual([])
    expect(payload.amount_updates).toEqual([])
  })

  it("manda los ids de los movimientos que sobran para que la RPC los elimine", () => {
    const payload = buildReconcileApplyPayload({
      ...base,
      deletions: [makeMovement({ id: "mov-9" }), makeMovement({ id: "mov-10" })],
    })
    expect(payload.deletions).toEqual(["mov-9", "mov-10"])
  })

  it("una corrección de importe usa el monto del PDF, no el cargado", () => {
    const payload = buildReconcileApplyPayload({
      ...base,
      amountFixes: [
        { line: makeLine({ amount: 7500 }), movement: makeMovement({ id: "mov-3", amount: 5000 }) },
      ],
    })
    expect(payload.amount_updates).toEqual([{ id: "mov-3", amount: 7500 }])
  })
})

describe("buildReconcilePlan", () => {
  function reviewLine(overrides: Partial<StatementReviewLine> = {}): StatementReviewLine {
    return {
      description: "Kiosco Don Pepe",
      date: "2026-06-15",
      amount: 1200,
      currency: "ARS",
      amount_ars: null,
      installment_number: null,
      installment_total: null,
      is_subscription: false,
      is_refund: false,
      category_id: null,
      selected: true,
      ...overrides,
    }
  }

  it("aplicar todo el diff deja el resumen clavado con el total del PDF", () => {
    // Cargado: 5000 (ok) + 3000 (debería ser 4000) + 900 (no está en el PDF).
    // PDF: 5000 + 4000 + 1200 (falta) = 10200.
    const cycleMovements = [
      makeMovement({ id: "ok", amount: 5000 }),
      makeMovement({ id: "mal", description: "Farmacia", amount: 3000 }),
      makeMovement({ id: "sobra", description: "Ferretería", amount: 900 }),
    ]
    const parsed = makeParsed([
      makeLine({ amount: 5000 }),
      makeLine({ description: "Farmacia", amount: 4000 }),
      makeLine({ description: "Kiosco Don Pepe", amount: 1200 }),
    ])
    parsed.total_ars = 10200

    const plan = buildReconcilePlan({
      parsed,
      cycleMovements,
      additions: [reviewLine()],
      fixes: [
        { line: makeLine({ description: "Farmacia", amount: 4000 }), movement: cycleMovements[1] },
      ],
      deletions: [cycleMovements[2]],
    })

    expect(plan).toMatchObject({ additions: 1, fixes: 1, deletions: 1, empty: false, allMatch: true })
    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.current).toBe(8900)
    expect(ars.after).toBe(10200)
    expect(ars.pdf).toBe(10200)
    expect(ars.difference).toBe(0)
    expect(ars.pdfFromLines).toBe(false)
  })

  it("sin nada tildado el plan queda vacío y muestra la diferencia contra el PDF", () => {
    const parsed = makeParsed([makeLine({ amount: 5000 }), makeLine({ description: "Farmacia", amount: 4000 })])
    parsed.total_ars = 9000
    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [makeMovement({ amount: 5000 })],
      additions: [],
      fixes: [],
      deletions: [],
    })
    expect(plan.empty).toBe(true)
    expect(plan.allMatch).toBe(false)
    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.after).toBe(5000)
    expect(ars.difference).toBe(-4000)
  })

  it("si el PDF no declara total, usa la suma de sus líneas y lo avisa", () => {
    const parsed = makeParsed([makeLine({ amount: 5000 })])
    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [makeMovement({ amount: 5000 })],
      additions: [],
      fixes: [],
      deletions: [],
    })
    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.pdf).toBe(5000)
    expect(ars.pdfFromLines).toBe(true)
    expect(ars.matches).toBe(true)
  })

  it("un reintegro resta en los dos lados (cargado y PDF), igual que en el resumen real", () => {
    const parsed = makeParsed([
      makeLine({ amount: 5000 }),
      makeLine({ description: "DEV.IMP", amount: 800, is_refund: true }),
    ])
    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [makeMovement({ amount: 5000 })],
      additions: [reviewLine({ description: "DEV.IMP", amount: 800, is_refund: true })],
      fixes: [],
      deletions: [],
    })
    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.after).toBe(4200)
    expect(ars.pdf).toBe(4200)
    expect(ars.matches).toBe(true)
  })

  it("separa ARS y USD: cada moneda cuadra contra su propio total del PDF", () => {
    const parsed = makeParsed([
      makeLine({ amount: 5000 }),
      makeLine({ description: "Claude", amount: 25.3, currency: "USD" }),
    ])
    parsed.total_ars = 5000
    parsed.total_usd = 25.3
    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [makeMovement({ amount: 5000 })],
      additions: [reviewLine({ description: "Claude", amount: 25.3, currency: "USD" })],
      fixes: [],
      deletions: [],
    })
    expect(plan.totals).toHaveLength(2)
    expect(plan.allMatch).toBe(true)
    expect(plan.totals.find((t) => t.currency === "USD")!.after).toBe(25.3)
  })

  // Caso real (Galicia VISA, cierre 27-ago-26): el banco acredita la
  // "DEV.IMP. RG 5617" contra el SALDO ANTERIOR el mismo día del pago, así
  // que cae dentro del ciclo pero NO integra el TOTAL A PAGAR de este
  // resumen. Si contara, el resumen daría 89.418,91 menos que el PDF.
  it("una devolución que cancela el saldo anterior no se cuenta contra el total del PDF", () => {
    const devImp = makeLine({
      description: "DEV.IMP. RG 5617 30%",
      amount: 89418.91,
      is_refund: true,
      settles_previous: true,
    })
    const parsed = makeParsed([makeLine({ amount: 431289.23 }), devImp])
    parsed.total_ars = 431289.23

    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [makeMovement({ amount: 431289.23 })],
      additions: [
        reviewLine({
          description: "DEV.IMP. RG 5617 30%",
          amount: 89418.91,
          is_refund: true,
          settles_previous: true,
        }),
      ],
      fixes: [],
      deletions: [],
    })

    // Se sigue importando (additions la cuenta), pero el total queda clavado.
    expect(plan.additions).toBe(1)
    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.after).toBe(431289.23)
    expect(ars.pdf).toBe(431289.23)
    expect(ars.difference).toBe(0)
    expect(plan.allMatch).toBe(true)
  })

  it("una devolución ya cargada como movimiento tampoco descuadra el ciclo al corroborar", () => {
    const parsed = makeParsed([
      makeLine({ amount: 431289.23 }),
      makeLine({
        description: "DEV.IMP. RG 5617 30%",
        amount: 89418.91,
        is_refund: true,
        settles_previous: true,
      }),
    ])
    parsed.total_ars = 431289.23

    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [
        makeMovement({ amount: 431289.23 }),
        makeMovement({
          id: "mov-dev",
          description: "DEV.IMP. RG 5617 30%",
          amount: 89418.91,
          type: "income",
        }),
      ],
      additions: [],
      fixes: [],
      deletions: [],
    })

    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.current).toBe(431289.23)
    expect(ars.after).toBe(431289.23)
    expect(ars.difference).toBe(0)
    expect(plan.allMatch).toBe(true)
  })

  it("una devolución normal (no settles_previous) sí resta del total del ciclo", () => {
    const parsed = makeParsed([
      makeLine({ amount: 10000 }),
      makeLine({ description: "Reintegro IVA", amount: 1000, is_refund: true }),
    ])
    parsed.total_ars = 9000

    const plan = buildReconcilePlan({
      parsed,
      cycleMovements: [makeMovement({ amount: 10000 })],
      additions: [reviewLine({ description: "Reintegro IVA", amount: 1000, is_refund: true })],
      fixes: [],
      deletions: [],
    })

    const ars = plan.totals.find((t) => t.currency === "ARS")!
    expect(ars.after).toBe(9000)
    expect(ars.difference).toBe(0)
  })
})
