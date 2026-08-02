import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkAiRateLimit } from "@/lib/ai/rate-limit"
import { extractMovement, type ExtractMovementResult } from "@/lib/ai/extract-movement"

const MODEL_ID = "gemini-2.5-flash"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login?redirectTo=/inicio", req.url), 303)
  }
  if (user.user_metadata?.is_demo === true) {
    return NextResponse.redirect(new URL("/inicio", req.url), 303)
  }

  const form = await req.formData()
  const imageEntry = form.get("image")
  const image = imageEntry instanceof File ? imageEntry : null
  const text = (form.get("text") as string | null) ?? null
  const title = (form.get("title") as string | null) ?? null
  const url = (form.get("url") as string | null) ?? null

  // Nothing to parse
  if (!image && !text && !title && !url) {
    return NextResponse.redirect(new URL("/inicio", req.url), 303)
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.redirect(new URL("/inicio", req.url), 303)
  }
  let allowed: boolean
  try {
    ;({ allowed } = await checkAiRateLimit(admin, user.id, MODEL_ID))
  } catch {
    return NextResponse.redirect(new URL("/inicio", req.url), 303)
  }
  if (!allowed) {
    return NextResponse.redirect(new URL("/inicio?compartir=limite", req.url), 303)
  }

  // Fetch user accounts and categories
  const [{ data: accountsData }, { data: categoriesData }] = await Promise.all([
    supabase.from("accounts").select("name"),
    supabase.from("categories").select("name, type"),
  ])
  const accounts: string[] = (accountsData ?? []).map((a) => a.name)
  const categories: { name: string; type: string }[] = (categoriesData ?? []).map((c) => ({
    name: c.name,
    type: c.type,
  }))

  let draft: ExtractMovementResult

  try {
    if (image) {
      const bytes = new Uint8Array(await image.arrayBuffer())
      draft = await extractMovement({
        image: bytes,
        imageMediaType: image.type || "image/jpeg",
        accounts,
        categories,
      })
    } else {
      const combined = [title, text, url].filter(Boolean).join(" ")
      draft = await extractMovement({ text: combined, accounts, categories })
    }
  } catch {
    // Fallback draft so the user still gets an open form
    const fallbackNota = [title, text, url].filter(Boolean).join(" ") || "Revisá el comprobante compartido"
    draft = {
      type: "expense",
      amount: 0,
      original_currency: "ARS",
      categoria: null,
      cuenta: null,
      cuenta_idx: null,
      fecha: null,
      nota: fallbackNota,
      cuotas: null,
    }
  }

  const res = NextResponse.redirect(new URL("/inicio?compartir=1", req.url), 303)
  res.cookies.set("mangui-share-draft", encodeURIComponent(JSON.stringify(draft)), {
    maxAge: 120,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  })
  return res
}
