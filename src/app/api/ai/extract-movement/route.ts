import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPremium, FREE } from "@/lib/plans"
import { todayAR } from "@/lib/date-utils"
import { extractMovement } from "@/lib/ai/extract-movement"

const MODEL_ID = "gemini-2.5-flash"
export const maxDuration = 30

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

  try {
    const object = await extractMovement(
      mediaBytes
        ? mediaKind === "image"
          ? { image: mediaBytes, imageMediaType: mediaMediaType, accounts: accountNames, categories }
          : { audio: mediaBytes, audioMediaType: mediaMediaType, accounts: accountNames, categories }
        : { text, accounts: accountNames, categories }
    )
    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: "No pude interpretar el movimiento. Probá de nuevo." }, { status: 422 })
  }
}
