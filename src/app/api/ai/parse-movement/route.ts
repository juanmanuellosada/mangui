import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateObject } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

// Argentina timezone offset for "today"
const AR_TZ = "America/Argentina/Buenos_Aires"

const DAILY_LIMIT = 30
const MODEL_ID = "gemini-2.5-flash"

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

  // 3. Check server-side API key
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "La IA no está disponible en este momento. Contactá soporte." },
      { status: 500 }
    )
  }

  // 4. Rate limiting — admin client bypasses RLS
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Servicio no disponible. Contactá soporte." },
      { status: 503 }
    )
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("ai_unlimited")
    .eq("id", user.id)
    .maybeSingle()

  const isUnlimited = profile?.ai_unlimited === true

  if (!isUnlimited) {
    const todayStart = `${getTodayAR()}T00:00:00.000Z`
    const { count, error: countError } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart)

    if (countError) {
      return NextResponse.json(
        { error: "Error al verificar uso diario." },
        { status: 500 }
      )
    }

    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Alcanzaste el límite diario de interpretaciones. Probá de nuevo mañana.",
        },
        { status: 429 }
      )
    }
  }

  // 5. Build AI model
  const google = createGoogleGenerativeAI({ apiKey })
  const model = google(MODEL_ID)

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
    const msg = err instanceof Error ? err.message.toLowerCase() : ""
    const isQuota =
      msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")
    return NextResponse.json(
      {
        error: "ai_unavailable",
        message: isQuota
          ? "La IA está temporalmente ocupada. Probá de nuevo en unos minutos."
          : "La IA no está disponible en este momento, probá más tarde.",
      },
      { status: 503 }
    )
  }

  // 8. Log usage (fire-and-forget; non-blocking)
  admin.from("ai_usage").insert({ user_id: user.id, model: MODEL_ID }).then()

  // 9. Map categoryName → category_id and accountName → account_id server-side
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
