import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptSecret } from "@/lib/crypto"
import { generateObject } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { z } from "zod"

// Argentina timezone offset for "today"
const AR_TZ = "America/Argentina/Buenos_Aires"

function getTodayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: AR_TZ })
}

const draftSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  currency: z.enum(["ARS", "USD"]),
  categoryName: z.string().nullable(),
  accountName: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().nullable(),
})

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function findMatch(
  name: string | null,
  items: Array<{ id: string; name: string }>
): string | null {
  if (!name) return null
  const target = normalizeStr(name)
  // Exact match (case-insensitive, ignoring accents)
  const exact = items.find((i) => normalizeStr(i.name) === target)
  if (exact) return exact.id
  // Fuzzy: one includes the other
  const fuzzy = items.find(
    (i) => normalizeStr(i.name).includes(target) || target.includes(normalizeStr(i.name))
  )
  return fuzzy?.id ?? null
}

function friendlyProviderError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()
  if (lower.includes("401") || lower.includes("403") || lower.includes("invalid api key") || lower.includes("authentication")) {
    return "API key inválida. Verificá la clave en Ajustes › Inteligencia artificial."
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota") || lower.includes("limit exceeded")) {
    return "Límite o cuota de tu proveedor de IA alcanzado. Intentá en unos minutos."
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist"))) {
    return "El modelo seleccionado no está disponible. Cambiá el modelo en Ajustes › Inteligencia artificial."
  }
  return "No se pudo interpretar el texto con tu proveedor de IA. Intentá de nuevo."
}

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // 2. Parse body
  let text: string
  try {
    const body = await req.json()
    text = typeof body?.text === "string" ? body.text.trim() : ""
    if (!text) {
      return NextResponse.json({ error: "El texto no puede estar vacío" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  // 3. Load AI settings via admin client (bypasses RLS on api_key_encrypted)
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Servicio no disponible. Contactá soporte." },
      { status: 503 }
    )
  }

  const { data: aiSettings, error: settingsError } = await admin
    .from("user_ai_settings")
    .select("provider, model, api_key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle()

  if (settingsError) {
    return NextResponse.json({ error: "Error al cargar configuración de IA." }, { status: 500 })
  }

  if (!aiSettings?.api_key_encrypted) {
    return NextResponse.json(
      {
        error: "no_key",
        message:
          "Configurá tu API key de IA en Ajustes › Inteligencia artificial para usar esta función.",
      },
      { status: 400 }
    )
  }

  // 4. Decrypt key (server-side only)
  let apiKey: string
  try {
    apiKey = await decryptSecret(aiSettings.api_key_encrypted)
  } catch {
    return NextResponse.json(
      { error: "Error al acceder a tu API key. Reconectá tu clave en Ajustes." },
      { status: 500 }
    )
  }

  const provider = aiSettings.provider as "google" | "openai" | "anthropic"
  const modelId = aiSettings.model

  // 5. Build AI model instance
  let model
  try {
    if (provider === "google") {
      const google = createGoogleGenerativeAI({ apiKey })
      model = google(modelId || "gemini-2.0-flash")
    } else if (provider === "openai") {
      const openai = createOpenAI({ apiKey })
      model = openai(modelId || "gpt-4o-mini")
    } else {
      const anthropic = createAnthropic({ apiKey })
      model = anthropic(modelId || "claude-3-5-haiku-latest")
    }
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err) }, { status: 500 })
  }

  // 6. Fetch user categories and accounts
  const [categoriesRes, accountsRes] = await Promise.all([
    supabase.from("categories").select("id, name, type").order("name"),
    supabase.from("accounts").select("id, name, currency, is_hidden").order("created_at"),
  ])

  const categories = categoriesRes.data ?? []
  const accounts = (accountsRes.data ?? []).filter((a) => !a.is_hidden)

  const incomeCategories = categories
    .filter((c) => c.type === "income")
    .map((c) => c.name)
  const expenseCategories = categories
    .filter((c) => c.type === "expense")
    .map((c) => c.name)
  const accountNames = accounts.map((a) => a.name)

  const today = getTodayAR()

  const systemPrompt = `Sos un asistente de finanzas personales para un usuario argentino.
Tu tarea es interpretar texto libre sobre gastos o ingresos y extraer datos estructurados.

Hoy es: ${today} (zona horaria: America/Argentina/Buenos_Aires).

Categorías de INGRESOS disponibles: ${incomeCategories.length > 0 ? incomeCategories.join(", ") : "(ninguna)"}
Categorías de GASTOS disponibles: ${expenseCategories.length > 0 ? expenseCategories.join(", ") : "(ninguna)"}
Cuentas disponibles: ${accountNames.length > 0 ? accountNames.join(", ") : "(ninguna)"}

Reglas:
- Inferí si es ingreso (income) o gasto (expense).
- Extraé el monto como número positivo y la moneda (ARS o USD; default ARS).
- Mapeá la categoría al nombre MÁS CERCANO de la lista; null si ninguno aplica.
- Mapeá la cuenta al nombre MÁS CERCANO de la lista; null si ninguno aplica.
- Resolvé fechas relativas ("hoy", "ayer", "el viernes pasado") al formato YYYY-MM-DD relativo a hoy (${today}).
- Guardá una nota corta (máx 80 chars) con el detalle principal. null si no hay nada relevante.
- Respondé SIEMPRE con el objeto JSON pedido, sin texto adicional.`

  const userPrompt = `Texto del usuario: "${text}"`

  // 7. Call AI
  let parsed
  try {
    const result = await generateObject({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      schema: draftSchema,
    })
    parsed = result.object
  } catch (err) {
    return NextResponse.json({ error: friendlyProviderError(err) }, { status: 422 })
  }

  // 8. Map categoryName → category_id and accountName → account_id server-side
  const relevantCategories = categories.filter(
    (c) => c.type === (parsed.kind === "income" ? "income" : "expense")
  )
  const category_id = findMatch(parsed.categoryName, relevantCategories)

  let account_id = findMatch(parsed.accountName, accounts)
  // Default: first visible account whose currency matches, or just first account
  if (!account_id && accounts.length > 0) {
    const currencyMatch = accounts.find((a) => a.currency === parsed.currency)
    account_id = (currencyMatch ?? accounts[0]).id
  }

  return NextResponse.json({
    draft: {
      type: parsed.kind,
      amount: parsed.amount,
      original_currency: parsed.currency,
      category_id: category_id,
      account_id: account_id,
      date: parsed.date,
      note: parsed.note ?? "",
      is_future: false,
      dollar_type: null,
      converted_amount: null,
    },
    detected: {
      categoryName: parsed.categoryName,
      accountName: parsed.accountName,
      currency: parsed.currency,
    },
  })
}
