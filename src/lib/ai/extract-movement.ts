import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"
import { todayAR } from "@/lib/date-utils"
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/accounts"

const MODEL_ID = "gemini-2.5-flash"

export const extractMovementSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number(),
  original_currency: z.enum(["ARS", "USD"]),
  categoria: z.string().nullable(),
  cuenta: z.string().nullable(),
  cuenta_idx: z.number().int().nullable(),
  fecha: z.string().nullable(),
  nota: z.string().nullable(),
  cuotas: z.number().int().nullable(),
})

export type ExtractMovementResult = z.infer<typeof extractMovementSchema>

/**
 * Cuenta con metadata (tipo, moneda) para desambiguar en el prompt. Un
 * string plano también es válido — compat con llamadores que sólo tienen el
 * nombre (ej. /compartir, que arma el draft desde un formData sin metadata).
 */
export type AiAccountInput = string | { name: string; type: string; currency: string }

export interface ExtractMovementInput {
  image?: Uint8Array
  imageMediaType?: string
  audio?: Uint8Array
  audioMediaType?: string
  text?: string
  accounts: AiAccountInput[]
  categories: { name: string; type: string }[]
}

function accountLine(a: AiAccountInput, idx: number): string {
  if (typeof a === "string") return `[${idx}] ${a}`
  const typeLabel = ACCOUNT_TYPE_LABELS[a.type as AccountType] ?? a.type
  return `[${idx}] ${a.name} (${typeLabel}, ${a.currency})`
}

export async function extractMovement(input: ExtractMovementInput): Promise<ExtractMovementResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error("La IA no está disponible en este momento.")

  const google = createGoogleGenerativeAI({ apiKey })
  const model = google(MODEL_ID)
  const today = todayAR()
  const incomeCats = input.categories.filter((c) => c.type === "income").map((c) => c.name)
  const expenseCats = input.categories.filter((c) => c.type === "expense").map((c) => c.name)

  const accountsList = input.accounts.map((a, i) => accountLine(a, i)).join("\n")

  const rules = `Hoy es ${today} (America/Argentina/Buenos_Aires).

Cuentas:
${accountsList || "(ninguna)"}
Categorías de GASTO: ${expenseCats.join(" | ") || "(ninguna)"}
Categorías de INGRESO: ${incomeCats.join(" | ") || "(ninguna)"}

Reglas:
- "type": "expense" para gastos/pagos/compras; "income" para cobros/ingresos/sueldos. Ante la duda, "expense".
- "amount": monto numérico sin símbolos ni separadores de miles. Si no hay monto, 0.
- "original_currency": "USD" si menciona dólares/USD/u$s; si no, "ARS".
- "cuenta_idx": el índice (el número entre corchetes) de la cuenta de la lista "Cuentas" que mejor coincida, usando también su tipo y moneda para desambiguar; null si ninguna coincide o la lista está vacía.
- "cuenta": como respaldo, el nombre de la cuenta elegida tal como figura en la lista (o tal como se mencionó, si no hay ninguna coincidencia clara); null si no aplica.
- "categoria": el nombre EXACTO de la lista de categorías del tipo correspondiente que mejor coincida; si ninguna, null.
- "fecha": formato YYYY-MM-DD. Interpretá fechas relativas ("hoy", "ayer", "5 de junio") respecto de hoy. Si no se menciona, usá ${today}.
- "nota": nota corta opcional (ej. comercio/detalle); null si no aporta.
- "cuotas": número de cuotas si se mencionan (ej. "en 3 cuotas" → 3); si no, null.
Devolvé SOLO los campos del esquema.`

  if (input.image) {
    const mediaType = input.imageMediaType || "image/jpeg"
    const prompt = `Extraé los datos de un movimiento financiero a partir de la IMAGEN adjunta (ticket/comprobante/factura). Leé el monto TOTAL, la fecha y el comercio (es-AR). Si el ticket muestra el medio de pago (VISA, MASTERCARD, DÉBITO, EFECTIVO o los últimos dígitos de una tarjeta), usalo para elegir la cuenta ("cuenta_idx"/"cuenta") de la lista que mejor coincida; si no se ve el medio de pago, dejalas en null.\n\n${rules}`
    const { object } = await generateObject({
      model,
      schema: extractMovementSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file", data: input.image, mediaType },
          ],
        },
      ],
    })
    return object
  }

  if (input.audio) {
    const mediaType = input.audioMediaType || "audio/wav"
    const prompt = `Extraé los datos de un movimiento financiero descripto en el AUDIO adjunto (español rioplatense, es-AR).\n\n${rules}`
    const { object } = await generateObject({
      model,
      schema: extractMovementSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file", data: input.audio, mediaType },
          ],
        },
      ],
    })
    return object
  }

  const text = input.text ?? ""
  const { object } = await generateObject({
    model,
    schema: extractMovementSchema,
    prompt: `Extraé los datos de un movimiento financiero a partir de este texto en español rioplatense (es-AR):\n"""${text}"""\n\n${rules}`,
  })
  return object
}
