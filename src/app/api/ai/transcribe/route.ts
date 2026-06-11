import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPremium, FREE } from "@/lib/plans"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

const AR_TZ = "America/Argentina/Buenos_Aires"
const MODEL_ID = "gemini-2.5-flash"
function getTodayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: AR_TZ })
}
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  if (user.user_metadata?.is_demo === true) {
    return NextResponse.json({ error: "demo", message: "No disponible en el modo demo." }, { status: 403 })
  }

  let bytes: Uint8Array
  let mediaType = "audio/wav"
  try {
    const form = await req.formData()
    const file = form.get("audio")
    if (!(file instanceof Blob)) return NextResponse.json({ error: "Audio faltante" }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Audio demasiado largo" }, { status: 413 })
    if (file.type) mediaType = file.type
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  if (bytes.length === 0) return NextResponse.json({ error: "Audio vacío" }, { status: 400 })

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
  try {
    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribí literalmente este audio en español rioplatense (es-AR). Devolvé SOLO la transcripción, sin comillas ni explicaciones. Si no hay habla clara, devolvé una cadena vacía." },
            { type: "file", data: bytes, mediaType },
          ],
        },
      ],
    })
    return NextResponse.json({ text: (text ?? "").trim() })
  } catch {
    return NextResponse.json({ error: "No pude transcribir el audio." }, { status: 422 })
  }
}
