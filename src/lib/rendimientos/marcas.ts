/**
 * Declarative map: fondo/entidad name → { marca, logo, conocida }.
 * Logo paths are relative to /icons/ar/bancos-billeteras/.
 * Matching is done by tokenising the input (lowercase, no accents, includes check).
 */

export interface MarcaInfo {
  marca: string
  logo: string | null
  conocida: boolean
}

// ── Declared brand entries ─────────────────────────────────────────────────────
// Each entry has: one or more match tokens, the display brand name, and the logo path.

interface BrandEntry {
  tokens: string[]
  marca: string
  logo: string | null
  conocida: boolean
}

const BRAND_ENTRIES: BrandEntry[] = [
  {
    tokens: ["mercado pago", "mercado fondo", "mercadopago"],
    marca: "Mercado Pago",
    logo: "/icons/ar/bancos-billeteras/mercadopago.svg",
    conocida: true,
  },
  {
    tokens: ["uala", "ualá", "ualintec"],
    marca: "Ualá",
    logo: "/icons/ar/bancos-billeteras/uala.svg",
    conocida: true,
  },
  {
    tokens: ["personal pay", "personalpay", "delta pesos"],
    marca: "Personal Pay",
    logo: "/icons/ar/bancos-billeteras/personal-pay.svg",
    conocida: true,
  },
  {
    tokens: ["cocos ahorro", "cocos crypto", "cocos"],
    marca: "Cocos",
    logo: "/icons/ar/bancos-billeteras/cocos.svg",
    conocida: true,
  },
  {
    tokens: ["naranja x", "naranjax"],
    marca: "Naranja X",
    logo: "/icons/ar/bancos-billeteras/naranja-x.svg",
    conocida: true,
  },
  {
    tokens: ["prex", "allaria ahorro"],
    marca: "Prex",
    logo: "/icons/ar/bancos-billeteras/prex.svg",
    conocida: true,
  },
  {
    tokens: ["lemon", "fima premium"],
    marca: "Lemon",
    logo: "/icons/ar/bancos-billeteras/lemon.svg",
    conocida: true,
  },
  {
    tokens: ["claro pay", "claropay", "sbs ahorro"],
    marca: "Claro Pay",
    logo: "/icons/ar/bancos-billeteras/claro-pay.svg",
    conocida: true,
  },
  {
    tokens: ["brubank"],
    marca: "Brubank",
    logo: "/icons/ar/bancos-billeteras/brubank.svg",
    conocida: true,
  },
  {
    tokens: ["belo"],
    marca: "Belo",
    logo: "/icons/ar/bancos-billeteras/belo.svg",
    conocida: true,
  },
  {
    tokens: ["modo"],
    marca: "Modo",
    logo: "/icons/ar/bancos-billeteras/modo.svg",
    conocida: true,
  },
  {
    tokens: ["fiwind"],
    marca: "Fiwind",
    logo: "/icons/ar/bancos-billeteras/fiwind.svg",
    conocida: true,
  },
  {
    tokens: ["buenbit"],
    marca: "Buenbit",
    logo: "/icons/ar/bancos-billeteras/buenbit.svg",
    conocida: true,
  },
  {
    tokens: ["ripio"],
    marca: "Ripio",
    logo: "/icons/ar/bancos-billeteras/ripio.svg",
    conocida: true,
  },
  {
    tokens: ["letsbit"],
    marca: "Letsbit",
    logo: "/icons/ar/bancos-billeteras/letsbit.svg",
    conocida: true,
  },
  {
    tokens: ["takenos"],
    marca: "Takenos",
    logo: "/icons/ar/bancos-billeteras/takenos.svg",
    conocida: true,
  },
  {
    tokens: ["nexo"],
    marca: "Nexo",
    logo: null,
    conocida: false,
  },
  {
    tokens: ["banco nacion", "banco de la nacion", "bna"],
    marca: "Banco Nación",
    logo: "/icons/ar/bancos-billeteras/banco-nacion.svg",
    conocida: true,
  },
  {
    tokens: ["banco provincia", "banco de la provincia", "bpba"],
    marca: "Banco Provincia",
    logo: "/icons/ar/bancos-billeteras/banco-provincia.svg",
    conocida: true,
  },
  {
    tokens: ["banco galicia", "galicia"],
    marca: "Banco Galicia",
    logo: "/icons/ar/bancos-billeteras/banco-galicia.svg",
    conocida: true,
  },
  {
    tokens: ["banco santander", "santander"],
    marca: "Banco Santander",
    logo: "/icons/ar/bancos-billeteras/banco-santander.svg",
    conocida: true,
  },
  {
    tokens: ["bbva"],
    marca: "BBVA",
    logo: "/icons/ar/bancos-billeteras/banco-bbva.svg",
    conocida: true,
  },
  {
    tokens: ["banco macro", "macro"],
    marca: "Banco Macro",
    logo: "/icons/ar/bancos-billeteras/banco-macro.svg",
    conocida: true,
  },
  {
    tokens: ["banco hsbc", "hsbc"],
    marca: "HSBC",
    logo: "/icons/ar/bancos-billeteras/banco-hsbc.svg",
    conocida: true,
  },
  {
    tokens: ["banco itau", "itau", "itaú"],
    marca: "Itaú",
    logo: "/icons/ar/bancos-billeteras/banco-itau.svg",
    conocida: true,
  },
  {
    tokens: ["banco icbc", "icbc"],
    marca: "ICBC",
    logo: "/icons/ar/bancos-billeteras/banco-icbc.svg",
    conocida: true,
  },
  {
    tokens: ["banco supervielle", "supervielle"],
    marca: "Supervielle",
    logo: "/icons/ar/bancos-billeteras/banco-supervielle.svg",
    conocida: true,
  },
  {
    tokens: ["banco ciudad", "ciudad"],
    marca: "Banco Ciudad",
    logo: "/icons/ar/bancos-billeteras/banco-ciudad.svg",
    conocida: true,
  },
  {
    tokens: ["bancor", "banco cordoba", "banco de cordoba"],
    marca: "Bancor",
    logo: "/icons/ar/bancos-billeteras/bancor.svg",
    conocida: true,
  },
  {
    tokens: ["banco credicoop", "credicoop"],
    marca: "Credicoop",
    logo: "/icons/ar/bancos-billeteras/banco-credicoop.svg",
    conocida: true,
  },
  {
    tokens: ["banco patagonia", "patagonia"],
    marca: "Banco Patagonia",
    logo: "/icons/ar/bancos-billeteras/banco-patagonia.svg",
    conocida: true,
  },
  {
    tokens: ["cuenta dni", "cuentadni"],
    marca: "Cuenta DNI",
    logo: "/icons/ar/bancos-billeteras/cuenta-dni.svg",
    conocida: true,
  },
  {
    tokens: ["capyfi"],
    marca: "CapyFi",
    logo: null,
    conocida: false,
  },
]

// ── Normalisation helper ───────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .trim()
}

// ── Public lookup ──────────────────────────────────────────────────────────────

/**
 * Returns brand info for a raw fund/entity name, or null if unrecognised.
 * Matching is case-insensitive, accent-insensitive, substring-based.
 */
export function lookupMarca(rawName: string): MarcaInfo | null {
  const norm = normalise(rawName)
  for (const entry of BRAND_ENTRIES) {
    for (const token of entry.tokens) {
      if (norm.includes(normalise(token))) {
        return { marca: entry.marca, logo: entry.logo, conocida: entry.conocida }
      }
    }
  }
  return null
}

/**
 * Applies brand info to an item:
 * - nombre becomes the brand name if a known brand is found
 * - nota gets the original technical name appended (or becomes a new nota)
 * - logo is set from the brand map
 * - conocida flag is set
 */
export function applyMarca<T extends { nombre: string; nota?: string; logo?: string | null; conocida?: boolean }>(
  item: T,
  rawName?: string,
): T & { conocida: boolean } {
  const nameToLookup = rawName ?? item.nombre
  const info = lookupMarca(nameToLookup)
  if (!info) {
    return { ...item, conocida: false }
  }
  return {
    ...item,
    nombre: info.marca,
    nota: item.nota
      ? `${nameToLookup} · ${item.nota}`
      : nameToLookup !== info.marca
        ? nameToLookup
        : item.nota,
    logo: info.logo ?? item.logo ?? null,
    conocida: info.conocida,
  }
}
