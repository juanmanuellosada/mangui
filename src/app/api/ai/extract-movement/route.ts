import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPremium, FREE } from "@/lib/plans"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

const AR_TZ = "America/Argentina/Buenos_Aires"
const MODEL_ID = "gemini-2.5-flash"
function getTodayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: AR_TZ })
}
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

  let body: { text?: string; accounts?: string[]; categories?: { name: string; type: string }[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }) }
  const text = (body.text ?? "").trim()
  if (!text) return NextResponse.json({ error: "Texto vacío" }, { status: 400 })
  const accountNames = Array.isArray(body.accounts) ? body.accounts.slice(0, 100) : []
  const categories = Array.isArray(body.categories) ? body.categories.slice(0, 300) : []

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
    const todayStart = `${getTodayAR()}T00:00:00.000Z`
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
  const today = getTodayAR()
  const incomeCats = categories.filter((c) => c.type === "income").map((c) => c.name)
  const expenseCats = categories.filter((c) => c.type === "expense").map((c) => c.name)

  try {
    const { object } = await generateObject({
      model,
      schema: extractSchema,
      prompt: `Extraé los datos de un movimiento financiero a partir de este texto en español rioplatense (es-AR):
"""${text}"""

Hoy es ${today} (America/Argentina/Buenos_Aires).

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
Devolvé SOLO los campos del esquema.`,
    })
    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: "No pude interpretar el movimiento. Probá reformularlo." }, { status: 422 })
  }
}
