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

Por cada consumo/línea del detalle (ítems de compras, NO el total ni los pagos/saldos anteriores):
- "description": el comercio o concepto tal como figura.
- "date": fecha del consumo, formato YYYY-MM-DD.
- "amount": monto de la línea, numérico sin símbolos ni separadores de miles.
- "currency": "USD" si la línea está en dólares; si no, "ARS".
- "amount_ars": si la línea está en USD Y el resumen muestra el equivalente en pesos para esa línea, ese monto; si no aplica o no se muestra, null.
- "installment_number" / "installment_total": si el concepto indica "cuota X/N" (o similar, ej. "3/12"), extraé X como installment_number y N como installment_total; si no es una compra en cuotas, ambos null.
- "category_hint": el nombre EXACTO de la lista de categorías de gasto del usuario que mejor coincida con el consumo; si ninguna coincide, null.

No incluyas como línea el total del resumen, saldos anteriores, ni pagos realizados a la tarjeta. Devolvé SOLO los campos del esquema.`

  const { object } = await generateObject({
    model,
    schema: parsedStatementSchema,
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
