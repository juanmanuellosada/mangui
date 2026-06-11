import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPremium, FREE } from "@/lib/plans"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

import { todayAR } from "@/lib/date-utils"

const MODEL_ID = "gemini-2.5-flash"
export const maxDuration = 30

const extractSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number(),
  original_currency: z.enum(["ARS", "USD"]),
  categoria: z.string().nullable(),
  cuenta: z.string().nullable(),
  fecha: z.string().nullable(),
  nota: z.string().nullable(),
  cuotas: z.number().int().nullable(),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  if (user.user_metadata?.is_demo === true) {
    return NextResponse.json({ error: "demo", message: "No disponible en el modo demo." }, { status: 403 })
  }

  // ── Parse input: JSON (text) OR multipart/form-data (audio or image) ──
  let text = ""
  let mediaBytes: Uint8Array | null = null
  let mediaMediaType = "audio/wav"
  let mediaKind: "audio" | "image" = "audio"
  let accountNames: string[] = []
  let categories: { name: string; type: string }[] = []

  const contentType = req.headers.get("content-type") || ""
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const imageFile = form.get("image")
      const audioFile = form.get("audio")
      const file = imageFile instanceof Blob ? imageFile : audioFile instanceof Blob ? audioFile : null
      if (!file) return NextResponse.json({ error: "Archivo faltante" }, { status: 400 })
      mediaKind = imageFile instanceof Blob ? "image" : "audio"
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 413 })
      if (file.type) mediaMediaType = file.type
      mediaBytes = new Uint8Array(await file.arrayBuffer())
      try { accountNames = JSON.parse((form.get("accounts") as string) || "[]") } catch { accountNames = [] }
      try { categories = JSON.parse((form.get("categories") as string) || "[]") } catch { categories = [] }
    } else {
      const body = await req.json()
      text = (body?.text ?? "").trim()
      accountNames = Array.isArray(body?.accounts) ? body.accounts : []
      categories = Array.isArray(body?.categories) ? body.categories : []
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  accountNames = accountNames.slice(0, 100)
  categories = categories.slice(0, 300)
  if (!mediaBytes && !text) return NextResponse.json({ error: "Entrada vacía" }, { status: 400 })

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "La IA no está disponible en este momento." }, { status: 500 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 })

  const { data: profile } = await admin
    .from("profiles")
    .select("ai_unlimited, plan, payment_exempt, mp_subscription_status")
    .eq("id", user.id)
    .maybeSingle()
  const premiumByPlan = isPremium({
    payment_exempt: profile?.payment_exempt ?? null,
    mp_subscription_status: profile?.mp_subscription_status ?? null,
  })
  const isUnlimited = premiumByPlan || profile?.ai_unlimited === true
  const dailyLimit = isUnlimited ? Infinity : FREE.aiPerDay
  if (dailyLimit !== Infinity) {
    const todayStart = `${todayAR()}T00:00:00.000Z`
    const { count, error: countError } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart)
    if (countError) return NextResponse.json({ error: "Error al verificar uso diario." }, { status: 500 })
    if ((count ?? 0) >= dailyLimit) {
      return NextResponse.json({ error: "rate_limited", message: "Alcanzaste el límite diario de IA." }, { status: 429 })
    }
  }
  admin.from("ai_usage").insert({ user_id: user.id, model: MODEL_ID }).then()

  const google = createGoogleGenerativeAI({ apiKey })
  const model = google(MODEL_ID)
  const today = todayAR()
  const incomeCats = categories.filter((c) => c.type === "income").map((c) => c.name)
  const expenseCats = categories.filter((c) => c.type === "expense").map((c) => c.name)

  const rules = `Hoy es ${today} (America/Argentina/Buenos_Aires).

Cuentas del usuario: ${accountNames.join(" | ") || "(ninguna)"}
Categorías de GASTO: ${expenseCats.join(" | ") || "(ninguna)"}
Categorías de INGRESO: ${incomeCats.join(" | ") || "(ninguna)"}

Reglas:
- "type": "expense" para gastos/pagos/compras; "income" para cobros/ingresos/sueldos. Ante la duda, "expense".
- "amount": monto numérico sin símbolos ni separadores de miles. Si no hay monto, 0.
- "original_currency": "USD" si menciona dólares/USD/u$s; si no, "ARS".
- "cuenta": el nombre EXACTO de la lista de cuentas que mejor coincida; si ninguna coincide, null.
- "categoria": el nombre EXACTO de la lista de categorías del tipo correspondiente que mejor coincida; si ninguna, null.
- "fecha": formato YYYY-MM-DD. Interpretá fechas relativas ("hoy", "ayer", "5 de junio") respecto de hoy. Si no se menciona, usá ${today}.
- "nota": nota corta opcional (ej. comercio/detalle); null si no aporta.
- "cuotas": número de cuotas si se mencionan (ej. "en 3 cuotas" → 3); si no, null.
Devolvé SOLO los campos del esquema.`

  try {
    const mediaInstruction = mediaKind === "image"
      ? `Extraé los datos de un movimiento financiero a partir de la IMAGEN adjunta (ticket/comprobante/factura). Leé el monto TOTAL, la fecha y el comercio (es-AR). Si el ticket muestra el medio de pago (VISA, MASTERCARD, DÉBITO, EFECTIVO o los últimos dígitos de una tarjeta), usalo para elegir la "cuenta" de la lista que mejor coincida; si no se ve el medio de pago, dejá "cuenta" en null.\n\n${rules}`
      : `Extraé los datos de un movimiento financiero descripto en el AUDIO adjunto (español rioplatense, es-AR).\n\n${rules}`

    const { object } = mediaBytes
      ? await generateObject({
          model,
          schema: extractSchema,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: mediaInstruction },
                { type: "file", data: mediaBytes, mediaType: mediaMediaType },
              ],
            },
          ],
        })
      : await generateObject({
          model,
          schema: extractSchema,
          prompt: `Extraé los datos de un movimiento financiero a partir de este texto en español rioplatense (es-AR):\n"""${text}"""\n\n${rules}`,
        })
    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: "No pude interpretar el movimiento. Probá de nuevo." }, { status: 422 })
  }
}
