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
  const accountsList = input.accounts.map((name, i) => `[${i}] ${name}`).join("\n")

  const prompt = `Extraé los datos de un RESUMEN DE TARJETA DE CRÉDITO argentino a partir del PDF adjunto (puede tener varias páginas).

Tarjetas del usuario:
${accountsList || "(ninguna)"}
Categorías de GASTO del usuario: ${expenseCats.join(" | ") || "(ninguna)"}

Datos del encabezado del resumen:
- "bank": nombre del banco o entidad emisora; null si no se identifica.
- "account_idx": el índice (el número entre corchetes) de la tarjeta de la lista "Tarjetas del usuario" que mejor coincida con este resumen (según el banco, últimos dígitos o nombre visible en el PDF); null si ninguna coincide o la lista está vacía.
- "account_hint": como respaldo, si no podés identificar el índice con confianza, una pista textual (últimos 4 dígitos o nombre) que ayude a identificar la tarjeta; null si no aplica.
- "close_date": fecha de cierre del resumen, formato YYYY-MM-DD; null si no figura.
- "due_date": fecha de vencimiento de pago, formato YYYY-MM-DD; null si no figura.
- "total_ars": total a pagar en PESOS ARGENTINOS. Copialo TAL CUAL del renglón "TOTAL A PAGAR" (o el rótulo equivalente) del PDF. NUNCA lo recalcules sumando líneas y NUNCA lo ajustes para que cierre con las líneas que devolvés: si tu suma no da igual, el que está mal es tu detalle, no el total. null sólo si el resumen realmente no trae un total en pesos.
- "total_usd": total a pagar en DÓLARES (resúmenes bimonetarios tienen un total separado en USD), con la misma regla: copiado tal cual, nunca recalculado ni ajustado. null si no aplica.
- "stamp_tax": impuesto de sellos/percepciones/impuestos provinciales del resumen (monto en pesos); null si no figura o es 0.
- "upcoming_installments": si el resumen incluye una tabla tipo "Cuotas a vencer" (o similar) con el total de cuotas por mes, devolvé un array de objetos {"month": <mes tal como figura, ej. "Agosto/26">, "amount": <total de ese mes, numérico sin símbolos ni separadores de miles>} en el MISMO ORDEN en que aparece en el PDF (cronológico), tal cual figuran, sin interpretar a qué período corresponde cada mes ni ajustar nada. Si el resumen no trae esa tabla, devolvé null.

Por cada consumo/línea del detalle (ítems de compras, IMPUESTOS y CARGOS del resumen; NO el total, ni las líneas descartadas más abajo):
- "description": el comercio o concepto tal como figura.
- "date": la fecha IMPRESA en la columna FECHA de esa misma fila, formato YYYY-MM-DD (si es una compra en cuotas, es la fecha de la compra original y también sale de ahí). Los impuestos y cargos del pie del resumen TAMBIÉN suelen traer su fecha impresa: usá ésa. Recién si la fila no tiene ninguna fecha propia, usá la fecha de cierre del resumen. Nunca uses la fecha de vencimiento como fecha de una línea.
- "amount": el monto que el banco COBRA por esa línea, leído SIEMPRE de las columnas de importe del detalle (las de la derecha, tituladas "PESOS" y "DÓLARES"), numérico sin símbolos ni separadores de miles.
- "currency": "USD" si el importe de la fila está en la columna DÓLARES; "ARS" si está en la columna PESOS.
- "amount_ars": si la línea está en USD Y el resumen muestra el equivalente en pesos para esa línea, ese monto; si no aplica o no se muestra, null.
- "installment_number" / "installment_total": si el concepto indica "cuota X/N" (o similar, ej. "3/12", "04/06"), extraé X como installment_number y N como installment_total; si no es una compra en cuotas, ambos null.
- "is_subscription": true si el concepto es un cargo mensual recurrente de un servicio de suscripción (p. ej. Claude, Netflix, Spotify, Disney+, gimnasio) SIN indicador de cuotas; false en cualquier otro caso. Una línea con installment_number/installment_total no nulos NUNCA es una suscripción (is_subscription debe ser false en ese caso).
- "is_refund": true SOLO si la línea es una devolución/reintegro de impuestos o percepciones (ver más abajo); false para cualquier otro concepto (consumos, impuestos, cargos).
- "settles_previous": true SOLO si esa devolución está imputada contra el SALDO ANTERIOR en vez de formar parte del TOTAL A PAGAR de este resumen (ver más abajo); false en todas las demás líneas.
- "category_hint": el nombre EXACTO de la lista de categorías de gasto del usuario que mejor coincida con el consumo; si ninguna coincide, null.

IMPORTANTE — moneda de la compra vs moneda del cobro: muchas filas muestran DENTRO de la referencia la moneda y el monto ORIGINAL de la compra (ej. "TEBEX.ORG USD 11,39", "RESEND USD 20,00", "Order o-y6es4pa EUR 17,67"). Ese número NO es necesariamente el importe de la línea: el importe es el que figura en la columna PESOS o DÓLARES de esa MISMA fila. Cuando la compra es en una moneda que no es ni pesos ni dólares (EUR, BRL, etc.), el banco igual la cobra en una de esas dos columnas y ahí suele haber otro número: si la referencia dice "EUR 17,67" pero la columna DÓLARES dice 20,45, la línea es amount=20.45 y currency="USD" (17,67 es el precio en euros, no lo que se paga). Ante cualquier diferencia entre el número de la referencia y el de la columna, GANA el de la columna.

IMPORTANTE — una fila con importe en LAS DOS columnas: algunos cargos del banco se cobran en pesos Y en dólares a la vez, con un número en la columna PESOS y otro en la columna DÓLARES de la MISMA fila (ej. Mastercard: "IMPUESTO DE SELLOS  2.877,57  0,20"). Cada línea del resultado tiene UNA sola moneda, así que esa fila se devuelve como DOS líneas con la misma "description": una con amount=2877.57 y currency="ARS", y otra con amount=0.20 y currency="USD". No elijas una y descartes la otra, y NO corras el importe en dólares a la fila de abajo: si lo hacés, uno de los dos totales no va a cerrar.

IMPORTANTE — impuestos y cargos: además de los consumos, el resumen SIEMPRE incluye impuestos y cargos que forman parte del TOTAL A PAGAR (ej. IVA como "DB IVA" o "IVA RG...", impuesto de sellos como "IMPUESTO DE SELLOS", percepciones como "PERCEPCION...", retenciones como "DB.RG 5617...", y cargos de servicio o administrativos como "GASTOS DE SERVICIO EMINENT"). Incluí CADA UNO de estos conceptos como una línea más, con su monto y moneda. NUNCA los omitas: son parte del total a pagar. Para estas líneas, "category_hint" = "Impuestos y comisiones" si esa categoría figura en la lista de categorías del usuario; si no figura, null.

IMPORTANTE — devoluciones y reintegros de impuestos (ej. "DEV.IMP.", "DEVOLUCION", "REINTEGRO"): SÍ hay que incluirlas como una línea más, con "is_refund": true y el monto SIEMPRE en POSITIVO (sin importar el signo con que figuren impresas en el resumen). "category_hint" en estas líneas siempre null.

IMPORTANTE — devoluciones que cancelan el SALDO ANTERIOR ("settles_previous"): muchos resúmenes traen, ARRIBA del "DETALLE DEL CONSUMO", un bloque (a veces rotulado "CONSOLIDADO") donde el banco liquida el resumen anterior: el "SALDO ANTERIOR", los pagos que hiciste, y a veces un crédito o devolución de impuestos imputado contra ese saldo. Ese crédito NO forma parte del TOTAL A PAGAR de este resumen: pertenece al ciclo anterior. Marcalo con "settles_previous": true (además de "is_refund": true) y NO lo cuentes en la verificación de sumas de más abajo.

Cómo reconocerlo, en este orden: (1) figura en ese bloque de arriba, junto al SALDO ANTERIOR y a los pagos, y no dentro del DETALLE DEL CONSUMO ni entre los impuestos y cargos del pie; (2) la cuenta cierra: saldo anterior − pagos − ese crédito ≈ 0. Ejemplo real de Galicia: "SALDO ANTERIOR 316.406,73", "SU PAGO EN PESOS −226.987,82", "DEV.IMP. RG 5617 30%( 298063,04) −89.418,91" → 316.406,73 − 226.987,82 − 89.418,91 = 0, así que esa DEV.IMP. va con "settles_previous": true. En cambio, una devolución que aparece dentro del detalle del período, o que hace falta para llegar al TOTAL A PAGAR, va con "settles_previous": false.

NO incluyas como línea de consumo el total del resumen ni las siguientes, que no son consumos: el saldo anterior (ej. "SALDO ANTERIOR") ni los pagos realizados a la tarjeta (ej. "SU PAGO", "PAGO SU CUENTA", "PAGO MINIMO"). Estas líneas nunca deben aparecer en el resultado, sin importar el signo de su monto.

OJO — el saldo anterior y los pagos quedan afuera SIEMPRE, en cualquier moneda y con cualquier bandera: una línea "SU PAGO EN PESOS" o "SU PAGO EN USD" nunca se devuelve, tampoco con "settles_previous": true. Lo único de ese bloque que SÍ va en el resultado son las devoluciones/reintegros de impuestos (ej. "DEV.IMP."): son plata que el banco te acreditó y hay que devolverlas como línea, marcadas con "settles_previous": true — eso es lo que las saca de la cuenta del total. Omitirlas es un error; incluir un pago también.

VERIFICACIÓN FINAL — el objetivo es que, POR MONEDA, la SUMA de las líneas de gasto devueltas (consumos + impuestos y cargos) MENOS la suma de las líneas de devolución/reintegro con "settles_previous": false dé el total a pagar del resumen: las líneas en ARS deben sumar "total_ars" y las líneas en USD deben sumar "total_usd". Las líneas con "settles_previous": true quedan FUERA de esta cuenta.

Antes de responder hacé esa cuenta para las dos monedas. Si alguna no cierra, el error está en las LÍNEAS, nunca en el total: revisá si falta una línea (impuestos y cargos son los que más se escapan), si tomaste el monto de la referencia en vez del de la columna de importes, o si una devolución que cancela el saldo anterior te quedó sin marcar "settles_previous": true. Corregí las líneas y dejá "total_ars" / "total_usd" exactamente como figuran impresos en el PDF.

Y antes de responder chequeá también esto, que es un olvido frecuente: volvé al bloque del SALDO ANTERIOR y contá cuántas devoluciones/reintegros hay ahí (los créditos que no son "SU PAGO"). Tienen que estar TODAS en tu array de líneas, con "settles_previous": true. Que no sumen al total NO es motivo para dejarlas afuera: si el resumen muestra una "DEV.IMP." y tu resultado no la trae, está incompleto.

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
  return clampLineDatesToClose(object)
}

/**
 * Ninguna línea puede estar fechada DESPUÉS del cierre: un consumo posterior
 * al corte entra en el resumen siguiente, no en éste.
 *
 * El modelo igual lo hace, y de forma recurrente, con los impuestos y cargos
 * que no traen fecha impresa (el bloque de totales de Mastercard, por
 * ejemplo): les pone la fecha de VENCIMIENTO. Esos movimientos quedaban en el
 * ciclo equivocado, marcados como futuros, y atribuidos al mes siguiente en
 * Estadísticas. Pedírselo al prompt no alcanzó —lo sigue haciendo—, así que se
 * corrige acá, que es determinístico y no depende de la corrida.
 *
 * Las fechas son YYYY-MM-DD, así que comparar como string es comparar
 * cronológicamente.
 */
export function clampLineDatesToClose(parsed: ParsedStatement): ParsedStatement {
  const close = parsed.close_date
  if (!close) return parsed
  return {
    ...parsed,
    lines: parsed.lines.map((l) => (l.date > close ? { ...l, date: close } : l)),
  }
}
