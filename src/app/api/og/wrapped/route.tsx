import { ImageResponse } from "next/og"
import { NextRequest, NextResponse } from "next/server"
import { format, subMonths, parse, startOfMonth, endOfMonth } from "date-fns"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { buildWrappedData } from "@/lib/wrapped"
import { buildIpcMap } from "@/lib/inflation/adjust"
import { formatCurrency } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SIZE = 1080

const COLORS = {
  bg: "#0B1410",
  card: "#132019",
  text: "#FAFAF9",
  textMuted: "rgba(250, 250, 249, 0.62)",
  primary: "#84CC16",
  accent: "#F97316",
  barTrack: "rgba(250, 250, 249, 0.12)",
}

const CATEGORY_COLORS = ["#84CC16", "#F97316", "#38BDF8"]

/**
 * Sin `?month` explícito: en los primeros 7 días del mes mostramos el cierre
 * del mes recién terminado; el resto del mes, el resumen del mes en curso.
 */
function resolveMonthRef(monthParam: string | null): string {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) return monthParam
  const today = new Date()
  const ref = today.getDate() <= 7 ? subMonths(today, 1) : today
  return format(ref, "yyyy-MM")
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function Footer() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <span style={{ fontSize: 22 }}>🥭</span>
      <span style={{ fontSize: 22, color: COLORS.textMuted }}>hecho con mangui · mangui.com.ar</span>
    </div>
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const monthRef = resolveMonthRef(req.nextUrl.searchParams.get("month"))
  const monthDate = parse(`${monthRef}-01`, "yyyy-MM-dd", new Date())
  const prevMonthDate = subMonths(monthDate, 1)

  const rangeFrom = format(startOfMonth(prevMonthDate), "yyyy-MM-dd")
  const rangeTo = format(endOfMonth(monthDate), "yyyy-MM-dd")

  const [movementsResult, categoriesResult, inflationResult] = await Promise.all([
    supabase.from("movements").select("*").gte("date", rangeFrom).lte("date", rangeTo),
    supabase.from("categories").select("*"),
    supabase.from("inflation_index").select("period, ipc").order("period", { ascending: true }),
  ])

  const movements = movementsResult.data ?? []
  const categories = categoriesResult.data ?? []
  const ipc = buildIpcMap(inflationResult.data ?? [])

  const wrapped = buildWrappedData(movements, categories, monthRef, {
    currency: "ARS",
    ipc,
    previousMonthMovements: movements,
  })

  const monthLabel = capitalize(wrapped.monthLabel)

  if (!wrapped.hasData) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: COLORS.bg,
            padding: 80,
            gap: 28,
          }}
        >
          <span style={{ fontSize: 120 }}>🥭</span>
          <span style={{ fontSize: 44, color: COLORS.text, fontWeight: 700, textAlign: "center" }}>
            {monthLabel}
          </span>
          <span style={{ fontSize: 30, color: COLORS.textMuted, textAlign: "center", maxWidth: 760 }}>
            Todavía no cargaste movimientos este mes. Anotalos en mangui para ver tu resumen.
          </span>
          <div style={{ display: "flex", marginTop: 40 }}>
            <Footer />
          </div>
        </div>
      ),
      { width: SIZE, height: SIZE }
    )
  }

  const savedPositive = wrapped.net >= 0

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: COLORS.bg,
          padding: 64,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 40 }}>🥭</span>
            <span style={{ fontSize: 32, color: COLORS.text, fontWeight: 700 }}>mangui</span>
          </div>
          <div
            style={{
              display: "flex",
              color: COLORS.primary,
              fontSize: 26,
              fontWeight: 700,
              background: "rgba(132, 204, 22, 0.12)",
              padding: "10px 22px",
              borderRadius: 999,
            }}
          >
            {monthLabel}
          </div>
        </div>

        {/* Hero: total gastado */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 6 }}>
          <span style={{ fontSize: 28, color: COLORS.textMuted }}>Gastaste</span>
          <span style={{ fontSize: 92, color: COLORS.text, fontWeight: 700 }}>
            {formatCurrency(wrapped.totalExpense, "ARS")}
          </span>
          {wrapped.vsPreviousMonth?.deltaPct != null && (
            <span
              style={{
                fontSize: 26,
                color: wrapped.vsPreviousMonth.deltaPct <= 0 ? COLORS.primary : COLORS.accent,
              }}
            >
              {wrapped.vsPreviousMonth.deltaPct >= 0 ? "+" : ""}
              {wrapped.vsPreviousMonth.deltaPct.toFixed(0)}% vs. el mes anterior
            </span>
          )}
        </div>

        {/* Ingresos / Ahorro chips */}
        <div style={{ display: "flex", gap: 20, marginTop: 36 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: COLORS.card,
              borderRadius: 24,
              padding: 26,
              gap: 6,
            }}
          >
            <span style={{ fontSize: 22, color: COLORS.textMuted }}>Ingresos</span>
            <span style={{ fontSize: 34, color: COLORS.text, fontWeight: 700 }}>
              {formatCurrency(wrapped.totalIncome, "ARS")}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: COLORS.card,
              borderRadius: 24,
              padding: 26,
              gap: 6,
            }}
          >
            <span style={{ fontSize: 22, color: COLORS.textMuted }}>{savedPositive ? "Ahorro" : "Déficit"}</span>
            <span style={{ fontSize: 34, color: savedPositive ? COLORS.primary : COLORS.accent, fontWeight: 700 }}>
              {formatCurrency(Math.abs(wrapped.net), "ARS")}
            </span>
          </div>
        </div>

        {/* Top categorías */}
        {wrapped.topCategories.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 20 }}>
            <span style={{ fontSize: 24, color: COLORS.textMuted }}>En qué se te fue la plata</span>
            {wrapped.topCategories.map((cat, i) => (
              <div key={cat.categoryId || cat.name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 32, width: 44, display: "flex" }}>{cat.icon ?? "📦"}</span>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 26, color: COLORS.text }}>{cat.name}</span>
                    <span style={{ fontSize: 26, color: COLORS.text, fontWeight: 700 }}>
                      {formatCurrency(cat.amount, "ARS")}
                    </span>
                  </div>
                  <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 999, background: COLORS.barTrack }}>
                    <div
                      style={{
                        display: "flex",
                        width: `${Math.min(100, cat.percent)}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gasto real vs nominal — el ángulo argentino. Se omite si el IPC del
            mes todavía no está publicado (ajuste ~0%, sin dato útil que mostrar). */}
        {wrapped.realVsNominal.adjusted != null &&
          wrapped.realVsNominal.deltaPct != null &&
          Math.abs(wrapped.realVsNominal.deltaPct) >= 1 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 40,
              background: COLORS.card,
              borderRadius: 24,
              padding: 26,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 22, color: COLORS.textMuted }}>Ese mismo gasto, en pesos de hoy</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 40, color: COLORS.text, fontWeight: 700 }}>
                {formatCurrency(wrapped.realVsNominal.adjusted, "ARS")}
              </span>
              <span style={{ fontSize: 24, color: COLORS.accent }}>
                (+{wrapped.realVsNominal.deltaPct.toFixed(0)}% por inflación)
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", marginTop: "auto", paddingTop: 32 }}>
          <Footer />
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE }
  )
}
