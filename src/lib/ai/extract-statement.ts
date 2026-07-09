import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateObject } from "ai"
import { parsedStatementSchema, type ParsedStatement } from "@/lib/ai/statement-schema"

const MODEL_ID = "gemini-2.5-flash"

export interface ExtractStatementInput {
  pdf: Uint8Array
  accounts: string[]
  categories: { name: string; type: string }[]
}

export async function extractStatement(input: ExtractStatementInput): Promise<ParsedStatement> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("La IA no está disponible en este momento.")

  const google = createGoogleGenerativeAI({ apiKey })
  const model = google(MODEL_ID)
  const expenseCats = input.categories.filter((c) => c.type === "expense").map((c) => c.name)

  const prompt = `Extraé los datos de un RESUMEN DE TARJETA DE CRÉDITO argentino a partir del PDF adjunto (puede tener varias páginas).

Tarjetas del usuario: ${input.accounts.join(" | ") || "(ninguna)"}
Categorías de GASTO del usuario: ${expenseCats.join(" | ") || "(ninguna)"}

Datos del encabezado del resumen:
- "bank": nombre del banco o entidad emisora; null si no se identifica.
- "account_hint": pista para identificar la tarjeta (últimos 4 dígitos o nombre) que mejor coincida con la lista de tarjetas del usuario; null si no hay pista clara.
- "close_date": fecha de cierre del resumen, formato YYYY-MM-DD; null si no figura.
- "due_date": fecha de vencimiento de pago, formato YYYY-MM-DD; null si no figura.
- "total_ars": total a pagar en PESOS ARGENTINOS; null si el resumen no tiene un total en pesos.
- "total_usd": total a pagar en DÓLARES (resúmenes bimonetarios tienen un total separado en USD); null si no aplica.
- "stamp_tax": impuesto de sellos/percepciones/impuestos provinciales del resumen (monto en pesos); null si no figura o es 0.
- "upcoming_installments": si el resumen incluye una tabla tipo "Cuotas a vencer" (o similar) con el total de cuotas por mes, devolvé un array de objetos {"month": <mes tal como figura, ej. "Agosto/26">, "amount": <total de ese mes, numérico sin símbolos ni separadores de miles>} en el MISMO ORDEN en que aparece en el PDF (cronológico). El PRIMER mes de esa tabla es siempre el período de ESTE resumen (mismo total que las cuotas del detalle que estás extrayendo). Si el resumen no trae esa tabla, devolvé null.

Por cada consumo/línea del detalle (ítems de compras, IMPUESTOS y CARGOS del resumen; NO el total, ni las líneas descartadas más abajo):
- "description": el comercio o concepto tal como figura.
- "date": fecha del consumo o, si es una compra en cuotas, la fecha de la compra original tal como figura en el resumen, formato YYYY-MM-DD. Si es un impuesto o cargo sin fecha propia, usá la fecha de cierre del resumen.
- "amount": monto de la línea, numérico sin símbolos ni separadores de miles.
- "currency": "USD" si la línea está en dólares; si no, "ARS".
- "amount_ars": si la línea está en USD Y el resumen muestra el equivalente en pesos para esa línea, ese monto; si no aplica o no se muestra, null.
- "installment_number" / "installment_total": si el concepto indica "cuota X/N" (o similar, ej. "3/12", "04/06"), extraé X como installment_number y N como installment_total; si no es una compra en cuotas, ambos null.
- "is_subscription": true si el concepto es un cargo mensual recurrente de un servicio de suscripción (p. ej. Claude, Netflix, Spotify, Disney+, gimnasio) SIN indicador de cuotas; false en cualquier otro caso. Una línea con installment_number/installment_total no nulos NUNCA es una suscripción (is_subscription debe ser false en ese caso).
- "is_refund": true SOLO si la línea es una devolución/reintegro de impuestos o percepciones (ver más abajo); false para cualquier otro concepto (consumos, impuestos, cargos).
- "category_hint": el nombre EXACTO de la lista de categorías de gasto del usuario que mejor coincida con el consumo; si ninguna coincide, null.

IMPORTANTE — impuestos y cargos: además de los consumos, el resumen SIEMPRE incluye impuestos y cargos que forman parte del TOTAL A PAGAR (ej. IVA como "DB IVA" o "IVA RG...", impuesto de sellos como "IMPUESTO DE SELLOS", percepciones como "PERCEPCION...", retenciones como "DB.RG 5617...", y cargos de servicio o administrativos como "GASTOS DE SERVICIO EMINENT"). Incluí CADA UNO de estos conceptos como una línea más, con su monto y moneda. NUNCA los omitas: son parte del total a pagar. Para estas líneas, "category_hint" = "Impuestos y comisiones" si esa categoría figura en la lista de categorías del usuario; si no figura, null.

IMPORTANTE — devoluciones y reintegros de impuestos (ej. "DEV.IMP.", "DEVOLUCION", "REINTEGRO"): a diferencia de versiones anteriores, SÍ hay que incluirlas como una línea más del detalle, con "is_refund": true y el monto SIEMPRE en POSITIVO (sin importar el signo con que figuren impresas en el resumen). "category_hint" en estas líneas siempre null.

NO incluyas como línea de consumo el total del resumen ni las siguientes, que no son consumos: el saldo anterior (ej. "SALDO ANTERIOR") ni los pagos realizados a la tarjeta (ej. "SU PAGO", "PAGO SU CUENTA", "PAGO MINIMO"). Estas líneas nunca deben aparecer en el resultado, sin importar el signo de su monto.

El objetivo es que la SUMA de todas las líneas de gasto devueltas (consumos + impuestos y cargos) MENOS la suma de las líneas de devolución/reintegro (is_refund: true) se aproxime al total a pagar del resumen ("total_ars"/"total_usd"): revisá el detalle completo para no dejar afuera ningún impuesto, cargo o devolución que figure en él.

Devolvé SOLO los campos del esquema.`

  const { object } = await generateObject({
    model,
    schema: parsedStatementSchema,
    maxOutputTokens: 32768,
    maxRetries: 3,
    providerOptions: {
      google: {
        thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "file", data: input.pdf, mediaType: "application/pdf" },
        ],
      },
    ],
  })
  return object
}
