/**
 * Data layer for ArgentinaDatos yield rates.
 * Server-only — never import from client code.
 * Fetches plazo fijo, FCI, stablecoins, letras, cuentas remuneradas USD,
 * criptopesos and plazo fijo UVA; normalises all rates to decimal fractions
 * (e.g. 0.19 = 19% TNA). Each section degrades independently via allSettled.
 */

import { applyMarca } from "./marcas"

export interface RateItem {
  nombre: string
  tna: number
  logo?: string | null
  enlace?: string | null
  nota?: string
  conocida?: boolean
  // Extra fields for specific instruments
  vencimiento?: string   // ISO date, for letras
  modalidad?: string     // for PF UVA
  moneda?: string        // for cripto
  subtitulo?: string     // original technical name when brand name replaces it
}

export interface Rendimientos {
  plazoFijo: RateItem[]
  billeteras: RateItem[]
  fci: RateItem[]
  usdFci: RateItem[]
  usdStablecoin: RateItem[]
  // New sections
  cuentasRemuneradasUsd: RateItem[]
  letras: RateItem[]
  criptopesos: RateItem[]
  pfUva: RateItem[]
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

interface StablecoinYield {
  moneda: string
  apy: number
  fecha: string
  [key: string]: unknown
}

interface StablecoinEntity {
  entidad: string
  rendimientos: StablecoinYield[]
}

// Shape of /v1/finanzas/cuentas-remuneradas-usd
// e.g. { entidad: "GALICIA", tasa: 0.02, tope: null }
interface CuentaRemuneradaUsd {
  entidad: string
  tasa: number
  tope: number | null
}

// Shape of /v1/finanzas/letras
// e.g. { ticker: "S30A6", fechaEmision: "...", fechaVencimiento: "...", tem: 3.53, vpv: 127.48 }
interface LetraRecord {
  ticker: string
  fechaEmision: string | null
  fechaVencimiento: string
  tem: number | null   // TEM = tasa efectiva mensual (percentage, NOT decimal)
  vpv: number | null
}

// Shape of /v1/finanzas/criptopesos
// e.g. { token: "wARS", entidad: "CAPYFI", tna: 0.2206 }
interface CriptopesosRecord {
  token: string
  entidad: string
  tna: number
}

// Shape of /v1/finanzas/tasas/plazoFijoUvaPagoPeriodico
// e.g. { id, entidad, logo, enlace, canal, moneda, plazoMinDias, plazoMaxDias, ..., tna, tea, ... }
interface PfUvaPagoPeriodicoRecord {
  id: string
  entidad: string
  logo: string | null
  enlace: string | null
  tna: number | null
  tea: number | null
}

// Shape of /v1/finanzas/tasas/plazoFijoPrecancelable — has nested tasas array
interface PfUvaTasaSlot {
  nombre: string
  plazoMinDias: number
  plazoMaxDias: number
  tna: number | null
  tea: number | null
}

interface PfUvaPrecancelableRecord {
  id: string
  entidad: string
  logo: string | null
  tasas: PfUvaTasaSlot[]
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

const BASE = "https://api.argentinadatos.com"

function adFetch<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, {
    headers: { "User-Agent": BROWSER_UA },
    next: { revalidate: 21600 },
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`)
    return r.json() as Promise<T>
  })
}

// ── Main fetcher ──────────────────────────────────────────────────────────────

export async function getRendimientos(): Promise<Rendimientos> {
  const updatedAt = new Date().toISOString()

  const [
    plazoFijoResult,
    ultimoResult,
    penultimoResult,
    stablecoinResult,
    cuentasUsdResult,
    letrasResult,
    criptopesosResult,
    pfUvaPagoPeriodicoResult,
    pfUvaPrecancelableResult,
  ] = await Promise.allSettled([
    adFetch<PlazoFijoRecord[]>("/v1/finanzas/tasas/plazoFijo"),
    adFetch<FciSnapshot[]>("/v1/finanzas/fci/mercadoDinero/ultimo"),
    adFetch<FciSnapshot[]>("/v1/finanzas/fci/mercadoDinero/penultimo"),
    adFetch<StablecoinEntity[]>("/v1/finanzas/rendimientos"),
    adFetch<CuentaRemuneradaUsd[]>("/v1/finanzas/cuentas-remuneradas-usd"),
    adFetch<LetraRecord[]>("/v1/finanzas/letras"),
    adFetch<CriptopesosRecord[]>("/v1/finanzas/criptopesos"),
    adFetch<PfUvaPagoPeriodicoRecord[]>("/v1/finanzas/tasas/plazoFijoUvaPagoPeriodico"),
    adFetch<PfUvaPrecancelableRecord[]>("/v1/finanzas/tasas/plazoFijoPrecancelable"),
  ])

  const plazoFijoRaw  = plazoFijoResult.status  === "fulfilled" ? plazoFijoResult.value  : []
  const ultimoRaw     = ultimoResult.status     === "fulfilled" ? ultimoResult.value     : []
  const penultimoRaw  = penultimoResult.status  === "fulfilled" ? penultimoResult.value  : []
  const stablecoinRaw = stablecoinResult.status === "fulfilled" ? stablecoinResult.value : []
  const cuentasUsdRaw = cuentasUsdResult.status === "fulfilled" ? cuentasUsdResult.value : []
  const letrasRaw     = letrasResult.status     === "fulfilled" ? letrasResult.value     : []
  const criptopesosRaw = criptopesosResult.status === "fulfilled" ? criptopesosResult.value : []
  const pfUvaPagoPeriodicoRaw  = pfUvaPagoPeriodicoResult.status  === "fulfilled" ? pfUvaPagoPeriodicoResult.value  : []
  const pfUvaPrecancelableRaw  = pfUvaPrecancelableResult.status  === "fulfilled" ? pfUvaPrecancelableResult.value  : []

  // ── Plazo fijo ────────────────────────────────────────────────────────────
  const plazoFijo: RateItem[] = (plazoFijoRaw as PlazoFijoRecord[])
    .filter((r) => typeof r.tnaClientes === "number" && r.tnaClientes > 0)
    .map((r) => {
      const base: RateItem = {
        nombre: r.entidad,
        tna: r.tnaClientes, // already a decimal fraction
        logo: r.logo ? r.logo.replace(/^http:\/\//i, "https://") : null,
        enlace: r.enlace ?? null,
      }
      return applyMarca(base)
    })
    .sort((a, b) => b.tna - a.tna)

  // ── FCI yield computation (two-snapshot approach) ─────────────────────────
  const penultimoByFondo = new Map<string, FciSnapshot>()
  for (const rec of penultimoRaw as FciSnapshot[]) {
    if (rec.fondo) penultimoByFondo.set(rec.fondo, rec)
  }

  const fciWithTna: Array<{
    fondo: string
    tna: number
    patrimonio: number | null
  }> = []

  for (const ultimo of ultimoRaw as FciSnapshot[]) {
    if (!ultimo.fondo || !ultimo.fecha || !(ultimo.vcp! > 0)) continue
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

    if (tna <= 0 || tna >= 2) continue

    fciWithTna.push({
      fondo: ultimo.fondo,
      tna,
      patrimonio: ultimo.patrimonio ?? null,
    })
  }

  fciWithTna.sort((a, b) => b.tna - a.tna)
  const topFci = fciWithTna.slice(0, 8)

  const fci: RateItem[] = topFci.map(({ fondo, tna }) => {
    const base: RateItem = { nombre: fondo, tna, nota: "estimado" }
    return applyMarca(base)
  })

  // ── USD FCI (dollar money-market funds) ──────────────────────────────────
  const usdFciWithTna: Array<{ fondo: string; tna: number }> = []

  for (const ultimo of ultimoRaw as FciSnapshot[]) {
    if (!ultimo.fondo || !ultimo.fecha || !(ultimo.vcp! > 0)) continue
    if (!/d[oó]lar/i.test(ultimo.fondo)) continue

    const penultimo = penultimoByFondo.get(ultimo.fondo)
    if (!penultimo || !penultimo.fecha || !(penultimo.vcp! > 0)) continue

    const daysBetween =
      (new Date(ultimo.fecha).getTime() -
        new Date(penultimo.fecha).getTime()) /
      86400000
    if (daysBetween <= 0) continue

    const dailyReturn = (ultimo.vcp! / penultimo.vcp! - 1) / daysBetween
    const tna = dailyReturn * 365

    if (tna <= 0 || tna >= 0.3) continue

    usdFciWithTna.push({ fondo: ultimo.fondo, tna })
  }

  usdFciWithTna.sort((a, b) => b.tna - a.tna)

  const usdFci: RateItem[] = usdFciWithTna.slice(0, 6).map(({ fondo, tna }) => {
    const base: RateItem = { nombre: fondo, tna, nota: "estimado · en dólares" }
    return applyMarca(base)
  })

  // ── USD Stablecoin (USDT + USDC + DAI + staking) ─────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const STABLECOIN_MONEDAS = new Set(["USDT", "USDC", "DAI"])

  const usdStablecoin: RateItem[] = []
  for (const entity of stablecoinRaw as StablecoinEntity[]) {
    const validEntries = (entity.rendimientos ?? []).filter(
      (r) =>
        STABLECOIN_MONEDAS.has(r.moneda) &&
        r.fecha &&
        new Date(r.fecha) >= thirtyDaysAgo &&
        r.apy > 0,
    )
    if (validEntries.length === 0) continue

    // Group best apy per moneda for this entity
    const bestByMoneda = new Map<string, number>()
    for (const r of validEntries) {
      const prev = bestByMoneda.get(r.moneda) ?? 0
      if (r.apy > prev) bestByMoneda.set(r.moneda, r.apy)
    }

    for (const [moneda, apy] of bestByMoneda) {
      const tna = apy / 100
      const rawName = entity.entidad.charAt(0).toUpperCase() + entity.entidad.slice(1)
      const base: RateItem = {
        nombre: rawName,
        tna,
        nota: `stablecoin ${moneda} · cripto`,
        moneda,
      }
      usdStablecoin.push(applyMarca(base, entity.entidad))
    }
  }
  usdStablecoin.sort((a, b) => b.tna - a.tna)
  const topUsdStablecoin = usdStablecoin.slice(0, 8)

  // ── Billeteras (wallet → FCI map) ─────────────────────────────────────────
  const fciTnaByFondo = new Map<string, number>()
  for (const { fondo, tna } of fciWithTna) {
    fciTnaByFondo.set(fondo, tna)
  }

  const billeteras: RateItem[] = []
  for (const { wallet, fund } of WALLET_FCI) {
    const tna = fciTnaByFondo.get(fund)
    if (tna === undefined) continue
    const logo = getLogo(wallet)
    billeteras.push({
      nombre: wallet,
      tna,
      nota: "vía el fondo donde coloca tu saldo",
      logo,
      conocida: true,
    })
  }
  billeteras.sort((a, b) => b.tna - a.tna)

  // ── Cuentas remuneradas USD ───────────────────────────────────────────────
  // Shape: [{ entidad, tasa, tope }] where tasa is decimal fraction (0.02 = 2%)
  const cuentasRemuneradasUsd: RateItem[] = (cuentasUsdRaw as CuentaRemuneradaUsd[])
    .filter((r) => typeof r.tasa === "number" && r.tasa > 0)
    .map((r) => {
      const base: RateItem = {
        nombre: r.entidad,
        tna: r.tasa, // already decimal fraction
        nota: r.tope != null ? `hasta USD ${r.tope.toLocaleString("es-AR")}` : undefined,
      }
      return applyMarca(base)
    })
    .sort((a, b) => b.tna - a.tna)

  // ── Letras del Tesoro ─────────────────────────────────────────────────────
  // Shape: [{ ticker, fechaEmision, fechaVencimiento, tem, vpv }]
  // tem = TEM (tasa efectiva mensual) in percentage (e.g. 3.53 = 3.53%/mes)
  // We convert TEM → TNA = tem/100 * 12 (simple annualisation)
  // Filter out past-due letters using Buenos Aires timezone
  const todayBsAs = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }),
  )
  todayBsAs.setHours(0, 0, 0, 0)

  const letras: RateItem[] = (letrasRaw as LetraRecord[])
    .filter((r) => {
      if (!r.fechaVencimiento) return false
      const venc = new Date(r.fechaVencimiento + "T00:00:00")
      return venc >= todayBsAs
    })
    .filter((r) => r.tem != null && r.tem > 0)
    .map((r) => {
      const temDecimal = r.tem! / 100 // 3.53 → 0.0353
      const tna = temDecimal * 12 // simple annualisation
      return {
        nombre: r.ticker,
        tna,
        nota: `vence ${formatLetrasDate(r.fechaVencimiento)}`,
        vencimiento: r.fechaVencimiento,
        conocida: false, // letters are instruments, not consumer brands
      }
    })
    .sort((a, b) => b.tna - a.tna)

  // ── Criptopesos ───────────────────────────────────────────────────────────
  // Shape: [{ token, entidad, tna }] where tna is decimal fraction
  const criptopesos: RateItem[] = (criptopesosRaw as CriptopesosRecord[])
    .filter((r) => typeof r.tna === "number" && r.tna > 0)
    .map((r) => {
      const rawName = r.entidad.charAt(0).toUpperCase() + r.entidad.slice(1)
      const base: RateItem = {
        nombre: rawName,
        tna: r.tna,
        nota: `token ${r.token} · criptopesos`,
        moneda: r.token,
      }
      return applyMarca(base, r.entidad)
    })
    .sort((a, b) => b.tna - a.tna)

  // ── Plazo Fijo UVA ────────────────────────────────────────────────────────
  // Pago periódico: flat shape per entity, single tna
  const pfUvaPagoPeriodico: RateItem[] = (pfUvaPagoPeriodicoRaw as PfUvaPagoPeriodicoRecord[])
    .filter((r) => typeof r.tna === "number" && r.tna != null && r.tna >= 0)
    .map((r) => {
      const base: RateItem = {
        nombre: r.entidad,
        tna: r.tna ?? 0,
        nota: "UVA · pago periódico",
        logo: r.logo ? r.logo.replace(/^http:\/\//i, "https://") : null,
        enlace: r.enlace ?? null,
        modalidad: "pago periódico",
      }
      return applyMarca(base)
    })

  // Precancelable: has nested tasas[] — pick best TNA slot per entity
  const pfUvaPrecancelable: RateItem[] = (pfUvaPrecancelableRaw as PfUvaPrecancelableRecord[])
    .flatMap((r) => {
      if (!r.tasas || r.tasas.length === 0) return []
      const bestSlot = r.tasas
        .filter((s) => s.tna != null && s.tna >= 0)
        .sort((a, b) => (b.tna ?? 0) - (a.tna ?? 0))[0]
      if (!bestSlot) return []
      const base: RateItem = {
        nombre: r.entidad,
        tna: bestSlot.tna ?? 0,
        nota: "UVA · precancelable",
        logo: r.logo ? r.logo.replace(/^http:\/\//i, "https://") : null,
        modalidad: "precancelable",
      }
      return [applyMarca(base)]
    })

  // Merge both UVA lists, deduplicate by nombre+modalidad, sort desc
  const pfUva: RateItem[] = [...pfUvaPagoPeriodico, ...pfUvaPrecancelable].sort(
    (a, b) => b.tna - a.tna,
  )

  return {
    plazoFijo,
    billeteras,
    fci,
    usdFci,
    usdStablecoin: topUsdStablecoin,
    cuentasRemuneradasUsd,
    letras,
    criptopesos,
    pfUva,
    updatedAt,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format letra vencimiento date as "17 abr 2026". */
function formatLetrasDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

const WALLET_LOGOS: Record<string, string> = {
  "Mercado Pago": "/icons/ar/bancos-billeteras/mercadopago.svg",
  "Ualá":         "/icons/ar/bancos-billeteras/uala.svg",
  "Personal Pay": "/icons/ar/bancos-billeteras/personal-pay.svg",
  "Cocos":        "/icons/ar/bancos-billeteras/cocos.svg",
  "Prex":         "/icons/ar/bancos-billeteras/prex.svg",
  "Lemon":        "/icons/ar/bancos-billeteras/lemon.svg",
  "Claro Pay":    "/icons/ar/bancos-billeteras/claro-pay.svg",
}

function getLogo(wallet: string): string | null {
  return WALLET_LOGOS[wallet] ?? null
}
