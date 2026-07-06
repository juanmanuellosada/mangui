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

Por cada consumo/línea del detalle (ítems de compras; NO el total, ni las líneas descartadas más abajo):
- "description": el comercio o concepto tal como figura.
- "date": fecha del consumo o, si es una compra en cuotas, la fecha de la compra original tal como figura en el resumen, formato YYYY-MM-DD.
- "amount": monto de la línea, numérico sin símbolos ni separadores de miles.
- "currency": "USD" si la línea está en dólares; si no, "ARS".
- "amount_ars": si la línea está en USD Y el resumen muestra el equivalente en pesos para esa línea, ese monto; si no aplica o no se muestra, null.
- "installment_number" / "installment_total": si el concepto indica "cuota X/N" (o similar, ej. "3/12", "04/06"), extraé X como installment_number y N como installment_total; si no es una compra en cuotas, ambos null.
- "is_subscription": true si el concepto es un cargo mensual recurrente de un servicio de suscripción (p. ej. Claude, Netflix, Spotify, Disney+, gimnasio) SIN indicador de cuotas; false en cualquier otro caso. Una línea con installment_number/installment_total no nulos NUNCA es una suscripción (is_subscription debe ser false en ese caso).
- "category_hint": el nombre EXACTO de la lista de categorías de gasto del usuario que mejor coincida con el consumo; si ninguna coincide, null.

NO incluyas como línea de consumo el total del resumen ni las siguientes, que no son consumos: el saldo anterior (ej. "SALDO ANTERIOR"), pagos realizados a la tarjeta (ej. "SU PAGO", "PAGO SU CUENTA", "PAGO MINIMO"), ni devoluciones o reintegros (ej. "DEV.IMP.", "DEVOLUCION", "REINTEGRO"). Estas líneas nunca deben aparecer en el resultado, sin importar el signo de su monto.

Devolvé SOLO los campos del esquema.`

  const { object } = await generateObject({
    model,
    schema: parsedStatementSchema,
    maxOutputTokens: 8192,
    maxRetries: 3,
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
