import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkAiRateLimit } from "@/lib/ai/rate-limit"
import { extractStatement } from "@/lib/ai/extract-statement"

const MODEL_ID = "gemini-2.5-flash"
const MAX_PDF_BYTES = 15 * 1024 * 1024
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  if (user.user_metadata?.is_demo === true) {
    return NextResponse.json({ error: "demo", message: "No disponible en el modo demo." }, { status: 403 })
  }

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  let pdfBytes: Uint8Array
  let accountNames: string[] = []
  let categories: { name: string; type: string }[] = []
  try {
    const form = await req.formData()
    const pdfFile = form.get("pdf")
    if (!(pdfFile instanceof Blob)) return NextResponse.json({ error: "Archivo faltante" }, { status: 400 })
    if (pdfFile.type && pdfFile.type !== "application/pdf") {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 })
    }
    if (pdfFile.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 413 })
    }
    pdfBytes = new Uint8Array(await pdfFile.arrayBuffer())
    try { accountNames = JSON.parse((form.get("accounts") as string) || "[]") } catch { accountNames = [] }
    try { categories = JSON.parse((form.get("categories") as string) || "[]") } catch { categories = [] }
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  accountNames = accountNames.slice(0, 100)
  categories = categories.slice(0, 300)

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

  try {
    const object = await extractStatement({ pdf: pdfBytes, accounts: accountNames, categories })
    return NextResponse.json(object)
  } catch (err) {
    console.error("[import-statement] extract failed:", err)
    return NextResponse.json({ error: "No pude interpretar el resumen. Probá de nuevo." }, { status: 422 })
  }
}
