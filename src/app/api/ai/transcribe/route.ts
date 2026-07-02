import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkAiRateLimit } from "@/lib/ai/rate-limit"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

const MODEL_ID = "gemini-2.5-flash"
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
  let allowed: boolean
  try {
    ;({ allowed } = await checkAiRateLimit(admin, user.id, MODEL_ID))
  } catch {
    return NextResponse.json({ error: "Error al verificar uso diario." }, { status: 500 })
  }
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited", message: "Alcanzaste el límite diario de IA." }, { status: 429 })
  }

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
