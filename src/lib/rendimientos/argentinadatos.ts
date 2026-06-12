/**
 * Data layer for ArgentinaDatos yield rates.
 * Server-only — never import from client code.
 * Fetches plazo fijo and FCI money-market data; normalises all rates to
 * decimal fractions (e.g. 0.19 = 19% TNA).
 */

export interface RateItem {
  nombre: string
  tna: number
  logo?: string | null
  enlace?: string | null
  nota?: string
}

export interface Rendimientos {
  plazoFijo: RateItem[]
  billeteras: RateItem[]
  fci: RateItem[]
  updatedAt: string
}

// ── Internal types for ArgentinaDatos responses ───────────────────────────────

interface PlazoFijoRecord {
  entidad: string
  logo: string | null
  tnaClientes: number
  tnaNoClientes: number
  enlace: string | null
}

interface FciSnapshot {
  fondo: string
  horizonte: string
  fecha: string | null
  vcp: number | null
  ccp: number | null
  patrimonio: number | null
}

// ── Wallet → FCI fund map ─────────────────────────────────────────────────────
// Exact fund names as they appear in /v1/finanzas/fci/mercadoDinero/ultimo.
// Cross-checked against comparatasas.ar mapping (June 2026).
// If a fund name isn't found in the API response, the wallet is silently omitted.

const WALLET_FCI: Array<{ wallet: string; fund: string }> = [
  { wallet: "Mercado Pago", fund: "Mercado Fondo - Clase A" },
  { wallet: "Ualá",         fund: "Ualintec Ahorro Pesos - Clase A" },
  { wallet: "Personal Pay", fund: "Delta Pesos - Clase X" },
  { wallet: "Cocos",        fund: "Cocos Ahorro - Clase A" },
  { wallet: "Prex",         fund: "Allaria Ahorro - Clase E" },
  { wallet: "Lemon",        fund: "Fima Premium - Clase P" },
  { wallet: "Claro Pay",    fund: "SBS Ahorro Pesos - Clase A" },
]

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

// ── Main fetcher ──────────────────────────────────────────────────────────────

export async function getRendimientos(): Promise<Rendimientos> {
  const updatedAt = new Date().toISOString()

  try {
    const [plazoFijoRaw, ultimoRaw, penultimoRaw] = await Promise.all([
      fetch("https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo", {
        headers: { "User-Agent": BROWSER_UA },
        next: { revalidate: 21600 },
      }).then((r) => (r.ok ? (r.json() as Promise<PlazoFijoRecord[]>) : [])),
      fetch(
        "https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/ultimo",
        {
          headers: { "User-Agent": BROWSER_UA },
          next: { revalidate: 21600 },
        },
      ).then((r) => (r.ok ? (r.json() as Promise<FciSnapshot[]>) : [])),
      fetch(
        "https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/penultimo",
        {
          headers: { "User-Agent": BROWSER_UA },
          next: { revalidate: 21600 },
        },
      ).then((r) => (r.ok ? (r.json() as Promise<FciSnapshot[]>) : [])),
    ])

    // ── Plazo fijo ────────────────────────────────────────────────────────────
    const plazoFijo: RateItem[] = (plazoFijoRaw as PlazoFijoRecord[])
      .filter((r) => typeof r.tnaClientes === "number" && r.tnaClientes > 0)
      .map((r) => ({
        nombre: r.entidad,
        tna: r.tnaClientes, // already a decimal fraction
        logo: r.logo ? r.logo.replace(/^http:\/\//i, "https://") : null,
        enlace: r.enlace ?? null,
      }))
      .sort((a, b) => b.tna - a.tna)

    // ── FCI yield computation (two-snapshot approach) ─────────────────────────
    // Index penultimo by fund name for O(1) lookup
    const penultimoByFondo = new Map<string, FciSnapshot>()
    for (const rec of penultimoRaw as FciSnapshot[]) {
      if (rec.fondo) penultimoByFondo.set(rec.fondo, rec)
    }

    // Compute TNA per fund using real day-count between the two snapshots
    const fciWithTna: Array<{
      fondo: string
      tna: number
      patrimonio: number | null
    }> = []

    for (const ultimo of ultimoRaw as FciSnapshot[]) {
      if (!ultimo.fondo || !ultimo.fecha || !(ultimo.vcp! > 0)) continue

      // Skip dollar-denominated funds
      if (/d[oó]lar/i.test(ultimo.fondo)) continue

      const penultimo = penultimoByFondo.get(ultimo.fondo)
      if (!penultimo || !penultimo.fecha || !(penultimo.vcp! > 0)) continue

      const daysBetween =
        (new Date(ultimo.fecha).getTime() -
          new Date(penultimo.fecha).getTime()) /
        86400000
      if (daysBetween <= 0) continue

      const dailyReturn = (ultimo.vcp! / penultimo.vcp! - 1) / daysBetween
      const tna = dailyReturn * 365

      // Sane filter: 0%–200% TNA
      if (tna <= 0 || tna >= 2) continue

      fciWithTna.push({
        fondo: ultimo.fondo,
        tna,
        patrimonio: ultimo.patrimonio ?? null,
      })
    }

    // Sort desc by TNA, take top 8
    fciWithTna.sort((a, b) => b.tna - a.tna)
    const topFci = fciWithTna.slice(0, 8)

    const fci: RateItem[] = topFci.map(({ fondo, tna }) => ({
      nombre: fondo,
      tna,
      nota: "estimado",
    }))

    // ── Billeteras (wallet → FCI map) ─────────────────────────────────────────
    // Build a lookup from all computed tna entries (not just top 8)
    const fciTnaByFondo = new Map<string, number>()
    for (const { fondo, tna } of fciWithTna) {
      fciTnaByFondo.set(fondo, tna)
    }

    const billeteras: RateItem[] = []
    for (const { wallet, fund } of WALLET_FCI) {
      const tna = fciTnaByFondo.get(fund)
      if (tna === undefined) continue // omit wallet if fund not found or not sane
      billeteras.push({
        nombre: wallet,
        tna,
        nota: "vía el fondo donde coloca tu saldo",
      })
    }
    billeteras.sort((a, b) => b.tna - a.tna)

    return { plazoFijo, billeteras, fci, updatedAt }
  } catch {
    // On any upstream failure, return empty arrays gracefully
    return { plazoFijo: [], billeteras: [], fci: [], updatedAt }
  }
}
