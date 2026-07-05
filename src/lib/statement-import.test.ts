import { describe, it, expect } from "vitest"
import {
  buildStatementPayload,
  buildPurchaseKey,
  buildSubscriptionKey,
  groupStatementPreviewByCycle,
  checkUpcomingInstallmentsTotal,
  type BuildStatementPayloadInput,
  type StatementReviewLine,
} from "./statement-import"
import { computeInstallmentDate } from "./installments"

function makeLine(overrides: Partial<StatementReviewLine> = {}): StatementReviewLine {
  return {
    description: "Super Chino",
    date: "2026-06-15",
    amount: 5000,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    is_subscription: false,
    category_id: "cat-1",
    selected: true,
    createRecurring: false,
    ...overrides,
  }
}

function makeInput(overrides: Partial<BuildStatementPayloadInput> = {}): BuildStatementPayloadInput {
  return {
    account_id: "acc-1",
    account_currency: "ARS",
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_amount: 5000,
    total_amount_usd: 0,
    stamp_tax: 100,
    lines: [makeLine()],
    ...overrides,
  }
}

describe("buildStatementPayload", () => {
  it("passes through header fields (totals) unchanged", () => {
    const payload = buildStatementPayload(
      makeInput({ total_amount: 12345, total_amount_usd: 67.5, stamp_tax: 200 })
    )
    expect(payload.account_id).toBe("acc-1")
    expect(payload.close_date).toBe("2026-06-20")
    expect(payload.due_date).toBe("2026-06-30")
    expect(payload.total_amount).toBe(12345)
    expect(payload.total_amount_usd).toBe(67.5)
    expect(payload.stamp_tax).toBe(200)
  })

  it("routes an installment line to installment_purchases instead of lines", () => {
    const payload = buildStatementPayload(
      makeInput({ lines: [makeLine({ description: "Notebook", installment_number: 3, installment_total: 12 })] })
    )
    expect(payload.lines).toHaveLength(0)
    expect(payload.installment_purchases).toHaveLength(1)
    expect(payload.installment_purchases[0].description).toBe("Notebook")
  })

  it("uses the plain description as note when there are no installments", () => {
    const payload = buildStatementPayload(makeInput({ lines: [makeLine({ description: "Super Chino" })] }))
    expect(payload.lines[0].note).toBe("Super Chino")
  })

  it("leaves converted_amount null and dollar_type null for a same-currency line", () => {
    const payload = buildStatementPayload(
      makeInput({ account_currency: "ARS", lines: [makeLine({ currency: "ARS" })] })
    )
    expect(payload.lines[0].original_currency).toBe("ARS")
    expect(payload.lines[0].converted_amount).toBeNull()
    expect(payload.lines[0].dollar_type).toBeNull()
  })

  it("ignores amount_ars from the PDF and leaves converted_amount null for a USD line on an ARS card (USD puro)", () => {
    const payload = buildStatementPayload(
      makeInput({
        account_currency: "ARS",
        lines: [makeLine({ currency: "USD", amount: 10, amount_ars: 13500 })],
      })
    )
    expect(payload.lines[0].original_currency).toBe("USD")
    expect(payload.lines[0].converted_amount).toBeNull()
    expect(payload.lines[0].dollar_type).toBe("tarjeta")
  })

  it("leaves converted_amount null for a USD line with no amount_ars ('USD puro') — no rate needed, doesn't throw", () => {
    const payload = buildStatementPayload(
      makeInput({
        account_currency: "ARS",
        lines: [makeLine({ currency: "USD", amount: 10, amount_ars: null })],
      })
    )
    expect(payload.lines[0].original_currency).toBe("USD")
    expect(payload.lines[0].converted_amount).toBeNull()
    expect(payload.lines[0].dollar_type).toBe("tarjeta")
  })

  it("excludes deselected lines from the payload", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [makeLine({ description: "Incluida", selected: true }), makeLine({ description: "Excluida", selected: false })],
      })
    )
    expect(payload.lines).toHaveLength(1)
    expect(payload.lines[0].note).toBe("Incluida")
  })

  it("creates a recurring transaction only when the line has createRecurring confirmed", () => {
    const confirmed = buildStatementPayload(
      makeInput({
        lines: [makeLine({ description: "Netflix", is_subscription: true, createRecurring: true, date: "2026-06-05" })],
      })
    )
    expect(confirmed.lines[0].create_recurring).toEqual({
      day_of_month: 5,
      subscription_key: buildSubscriptionKey("Netflix", "acc-1"),
    })

    const notConfirmed = buildStatementPayload(
      makeInput({ lines: [makeLine({ description: "Netflix", is_subscription: true, createRecurring: false })] })
    )
    expect(notConfirmed.lines[0].create_recurring).toBeNull()
  })

  it("creates a recurring transaction for a simple line the user marked as recurrent, even if the AI didn't flag it as a subscription", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [
          makeLine({
            description: "Cine Fan Black",
            is_subscription: false,
            createRecurring: true,
            date: "2026-06-05",
          }),
        ],
      })
    )
    expect(payload.lines[0].create_recurring).toEqual({
      day_of_month: 5,
      subscription_key: buildSubscriptionKey("Cine Fan Black", "acc-1"),
    })
  })

  it("reimportar el mismo resumen produce el mismo subscription_key (idempotencia de la recurrente)", () => {
    const juneImport = buildStatementPayload(
      makeInput({
        lines: [makeLine({ description: "Netflix", is_subscription: true, createRecurring: true, date: "2026-06-05" })],
      })
    )
    const julyImport = buildStatementPayload(
      makeInput({
        close_date: "2026-07-20",
        due_date: "2026-07-30",
        lines: [makeLine({ description: "Netflix", is_subscription: true, createRecurring: true, date: "2026-07-05" })],
      })
    )

    expect(julyImport.lines[0].create_recurring!.subscription_key).toBe(
      juneImport.lines[0].create_recurring!.subscription_key
    )
  })
})

describe("buildStatementPayload — proyección de cuotas (Tarea 3.2)", () => {
  it("proyecta las 6 cuotas de una compra 1/6, incluyendo la leída", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [
          makeLine({
            description: "Notebook",
            date: "2026-06-10",
            amount: 1000,
            installment_number: 1,
            installment_total: 6,
          }),
        ],
      })
    )
    expect(payload.installment_purchases).toHaveLength(1)
    const purchase = payload.installment_purchases[0]
    expect(purchase.installments).toHaveLength(6)
    expect(purchase.installments.map((i) => i.installment_number)).toEqual([1, 2, 3, 4, 5, 6])
    // Cuota fija: mismo monto leído en todas las cuotas proyectadas.
    expect(purchase.installments.every((i) => i.amount === 1000)).toBe(true)
    expect(purchase.start_date).toBe("2026-06-10")
    purchase.installments.forEach((installment, idx) => {
      expect(installment.date).toBe(computeInstallmentDate("2026-06-10", idx + 1))
    })
  })

  it("proyecta sólo las cuotas restantes (5/6 y 6/6) para una compra leída en 4/6, sin recrear las 3 anteriores", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [
          makeLine({
            description: "Heladera",
            date: "2026-01-10",
            amount: 2000,
            installment_number: 4,
            installment_total: 6,
          }),
        ],
      })
    )
    const purchase = payload.installment_purchases[0]
    // Incluye la cuota leída (4) y proyecta las restantes (5, 6); nunca 1-3.
    expect(purchase.installments.map((i) => i.installment_number)).toEqual([4, 5, 6])
  })

  it("excluye la compra y todas sus cuotas futuras si el usuario deselecciona la línea", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [makeLine({ installment_number: 1, installment_total: 6, selected: false })],
      })
    )
    expect(payload.installment_purchases).toHaveLength(0)
  })
})

describe("buildPurchaseKey (Tarea 3.1)", () => {
  it("es determinística para el mismo comercio/fecha/total de cuotas", () => {
    const key1 = buildPurchaseKey("Notebook Store SA", "2026-06-10", 6)
    const key2 = buildPurchaseKey("Notebook Store SA", "2026-06-10", 6)
    expect(key1).toBe(key2)
  })

  it("difiere si cambia el comercio, la fecha o el total de cuotas", () => {
    const base = buildPurchaseKey("Notebook Store SA", "2026-06-10", 6)
    expect(buildPurchaseKey("Otro Comercio", "2026-06-10", 6)).not.toBe(base)
    expect(buildPurchaseKey("Notebook Store SA", "2026-07-10", 6)).not.toBe(base)
    expect(buildPurchaseKey("Notebook Store SA", "2026-06-10", 12)).not.toBe(base)
  })
})

describe("groupStatementPreviewByCycle (Tarea 3.3)", () => {
  it("agrupa por ciclo: el leído (offset 0) + un grupo por cada ciclo futuro con cuotas", () => {
    const groups = groupStatementPreviewByCycle(
      makeInput({
        close_date: "2026-06-20",
        due_date: "2026-06-30",
        lines: [
          makeLine({ description: "Super Chino", installment_number: null, installment_total: null }),
          makeLine({ description: "Notebook", amount: 1000, installment_number: 1, installment_total: 3 }),
        ],
      })
    )
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.cycleOffset)).toEqual([0, 1, 2])

    // Offset 0: el gasto simple + la cuota 1/3 leída, ambas en ARS.
    expect(groups[0].closeDate).toBe("2026-06-20")
    expect(groups[0].dueDate).toBe("2026-06-30")
    expect(groups[0].lines).toHaveLength(2)
    expect(groups[0].totalsByCurrency).toEqual({ ARS: 6000, USD: 0 }) // 5000 (simple) + 1000 (cuota 1)

    // Offsets futuros: un mes por ciclo, sólo la cuota correspondiente.
    expect(groups[1].closeDate).toBe("2026-07-20")
    expect(groups[1].dueDate).toBe("2026-07-30")
    expect(groups[1].lines).toHaveLength(1)
    expect(groups[1].lines[0].installment_number).toBe(2)
    expect(groups[2].closeDate).toBe("2026-08-20")
  })

  it("separa los subtotales por moneda sin convertir cuando el resumen tiene consumos en ARS y USD", () => {
    const groups = groupStatementPreviewByCycle(
      makeInput({
        close_date: "2026-06-20",
        due_date: "2026-06-30",
        lines: [
          makeLine({ description: "Super Chino", amount: 5000, currency: "ARS" }),
          makeLine({ description: "Netflix", amount: 10, currency: "USD", amount_ars: 13500 }),
        ],
      })
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].totalsByCurrency).toEqual({ ARS: 5000, USD: 10 })
  })
})

describe("propagación de correcciones a cuotas futuras (Tarea 3.4)", () => {
  it("propaga el cambio de categoría de la línea leída a todas sus cuotas proyectadas", () => {
    const line = makeLine({ installment_number: 1, installment_total: 3, category_id: "cat-a" })

    const before = buildStatementPayload(makeInput({ lines: [line] }))
    expect(before.installment_purchases[0].installments.every((i) => i.category_id === "cat-a")).toBe(true)
    expect(before.installment_purchases[0].category_id).toBe("cat-a")

    const editedLine = { ...line, category_id: "cat-b" }
    const after = buildStatementPayload(makeInput({ lines: [editedLine] }))
    expect(after.installment_purchases[0].installments.every((i) => i.category_id === "cat-b")).toBe(true)
    expect(after.installment_purchases[0].category_id).toBe("cat-b")
  })

  it("editar una línea que no es cuota no afecta a otras líneas", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [
          makeLine({ description: "Simple A", category_id: "cat-a" }),
          makeLine({ description: "Simple B", category_id: "cat-b" }),
        ],
      })
    )
    expect(payload.lines.find((l) => l.note === "Simple A")?.category_id).toBe("cat-a")
    expect(payload.lines.find((l) => l.note === "Simple B")?.category_id).toBe("cat-b")
  })
})

describe("reconciliación por identidad de compra — conceptual (Tarea 3.6)", () => {
  it("dos imports de la misma compra producen el mismo purchase_key y claves (purchase_key, installment_number) consistentes", () => {
    // Import de junio: llega la compra en 1/6, se proyectan 2/6..6/6.
    const juneImport = buildStatementPayload(
      makeInput({
        lines: [
          makeLine({
            description: "Notebook Store",
            date: "2026-06-10",
            amount: 1000,
            installment_number: 1,
            installment_total: 6,
          }),
        ],
      })
    )

    // Import de julio: llega la misma compra, ahora real en 2/6.
    const julyImport = buildStatementPayload(
      makeInput({
        close_date: "2026-07-20",
        due_date: "2026-07-30",
        lines: [
          makeLine({
            description: "Notebook Store",
            date: "2026-06-10",
            amount: 1000,
            installment_number: 2,
            installment_total: 6,
          }),
        ],
      })
    )

    const junePurchase = juneImport.installment_purchases[0]
    const julyPurchase = julyImport.installment_purchases[0]

    // Misma identidad de compra: la RPC hace upsert por (user_id, purchase_key)
    // en vez de crear una segunda compra.
    expect(julyPurchase.purchase_key).toBe(junePurchase.purchase_key)

    // La cuota 2/6 proyectada en junio y la 2/6 real de julio comparten la
    // misma clave (purchase_key, installment_number) → la RPC actualiza en
    // vez de duplicar.
    const juneInstallment2 = junePurchase.installments.find((i) => i.installment_number === 2)
    const julyInstallment2 = julyPurchase.installments.find((i) => i.installment_number === 2)
    expect(juneInstallment2).toBeDefined()
    expect(julyInstallment2).toBeDefined()
    expect(julyInstallment2!.date).toBe(juneInstallment2!.date)

    // No hay números de cuota duplicados dentro del mismo import.
    const juneNumbers = junePurchase.installments.map((i) => i.installment_number)
    expect(new Set(juneNumbers).size).toBe(juneNumbers.length)
  })
})

describe("checkUpcomingInstallmentsTotal (Tarea 3.5)", () => {
  it("devuelve null cuando no hay total esperado del PDF", () => {
    const result = checkUpcomingInstallmentsTotal(
      makeInput({ lines: [makeLine({ installment_number: 1, installment_total: 3, amount: 1000 })] }),
      null
    )
    expect(result).toBeNull()
  })

  it("compara la suma de cuotas futuras (excluye la leída) contra el total esperado", () => {
    const input = makeInput({
      lines: [makeLine({ installment_number: 1, installment_total: 3, amount: 1000 })],
    })
    // Futuras (offset > 0): cuotas 2 y 3 = 2000.
    const matching = checkUpcomingInstallmentsTotal(input, 2000)
    expect(matching).toEqual({ expectedTotal: 2000, projectedTotal: 2000, matches: true, difference: 0 })

    const mismatching = checkUpcomingInstallmentsTotal(input, 2500)
    expect(mismatching?.matches).toBe(false)
    expect(mismatching?.difference).toBe(-500)
  })
})
