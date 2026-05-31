/**
 * fetch-ar-fintech-icons.mjs
 *
 * Pulls the Argentine fintech icon set from icons.com.ar (Next.js RSC flight)
 * and bundles SVGs into public/icons/ar/<category>/<id>.svg.
 * Also generates src/lib/ar-fintech-icons.ts (the catalog) and
 * public/icons/ar/NOTICE.md (attribution).
 *
 * Attribution: icons.com.ar — all logos/brands belong to their respective owners.
 * Run: node scripts/fetch-ar-fintech-icons.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const PUBLIC_AR = path.join(ROOT, "public", "icons", "ar")
const CATALOG_PATH = path.join(ROOT, "src", "lib", "ar-fintech-icons.ts")

// ── Category slug mapping ─────────────────────────────────────────────────────

const CATEGORY_SLUGS = {
  "Bancos y Billeteras": "bancos-billeteras",
  "Acciones": "acciones",
  "CEDEARs": "cedears",
  "Gerentes de FCI": "fci",
  "Monedas": "monedas",
}

// Ordered for display: Bancos first
const CATEGORY_ORDER = [
  "Bancos y Billeteras",
  "Acciones",
  "CEDEARs",
  "Gerentes de FCI",
  "Monedas",
]

// ── Step 1: fetch homepage ────────────────────────────────────────────────────

console.log("[1/6] Fetching icons.com.ar …")
const res = await fetch("https://icons.com.ar/", {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
  },
})
if (!res.ok) throw new Error(`HTTP ${res.status} from icons.com.ar`)
const html = await res.text()
console.log(`    HTML size: ${(html.length / 1024 / 1024).toFixed(2)} MB`)

// ── Step 2: extract and concatenate RSC flight chunks ─────────────────────────

console.log("[2/6] Extracting RSC flight chunks …")

// Match self.__next_f.push([1, "<JS-string-escaped>"])
// The arg is always a double-quoted JSON string literal per Next.js RSC output.
const pushRe = /self\.__next_f\.push\(\[1\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/gs

let flight = ""
let chunkCount = 0

for (const match of html.matchAll(pushRe)) {
  try {
    const chunk = JSON.parse(match[1])
    flight += chunk
    chunkCount++
  } catch {
    // skip unparseable chunks
  }
}

console.log(`    ${chunkCount} chunks, flight string: ${(flight.length / 1024 / 1024).toFixed(2)} MB`)

if (flight.length < 100_000) {
  throw new Error("Flight string too small — the page structure may have changed.")
}

// ── Step 3: build ref map (refId → svgString) ─────────────────────────────────
//
// RSC flight SVG refs come in two formats:
//
// Format A — T-type blob (raw binary/text, NOT JSON encoded):
//   <id>:T<hex-byte-length>,<raw-content>
//   The content is exactly hex-byte-length bytes; the next row starts immediately after.
//   T-blob rows are NOT always separated by newlines — they pack consecutively.
//   e.g.  2a:T5e9,<svg xmlns=...>...</svg>2b:T6f2,...
//
// Format B — JSON string value (fallback):
//   <id>:"<json-escaped svg>"
//
// Icon source refs in the JSX tree: "$<refId>" (the refId matches row IDs verbatim).

console.log("[3/6] Building ref map …")

const refs = {}

// --- Format A: T-type blobs ---
// Use a lookbehind to anchor on a non-alphanumeric character (end of prev row content
// or start of string), avoiding false matches inside SVG content.
const tRowRe = /(?<=[^0-9a-zA-Z]|^)([0-9a-zA-Z]+):T([0-9a-f]+),/g
let tm
while ((tm = tRowRe.exec(flight)) !== null) {
  const refId = tm[1]
  const byteLen = parseInt(tm[2], 16)
  const contentStart = tm.index + tm[0].length
  const raw = flight.slice(contentStart, contentStart + byteLen)
  if (raw.startsWith("<svg") || raw.startsWith("<?xml")) {
    refs[refId] = raw
  }
}

// --- Format B: JSON-string rows (fallback) ---
// Pattern: (boundary) <id>:"<svg..."
const jsonRowRe = /(?<=[^0-9a-zA-Z]|^)([0-9a-zA-Z]+):"(<svg|<\?xml)/g
let jm
while ((jm = jsonRowRe.exec(flight)) !== null) {
  const refId = jm[1]
  if (refs[refId]) continue  // already resolved via T-blob
  const openQuotePos = jm.index + jm[0].lastIndexOf('"')
  try {
    let i = openQuotePos + 1
    while (i < flight.length) {
      const ch = flight[i]
      if (ch === "\\") { i += 2; continue }
      if (ch === '"') break
      i++
    }
    const token = flight.slice(openQuotePos, i + 1)
    const svgStr = JSON.parse(token)
    refs[refId] = svgStr
  } catch {
    // skip
  }
}

console.log(`    ${Object.keys(refs).length} refs resolved`)

// ── Step 4: extract icon objects ──────────────────────────────────────────────

console.log("[4/6] Extracting icon objects …")

// Icon objects appear as JSON inside the flight JSX tree:
// {"_title":"Galicia","id":"banco-galicia","type":"Bancos y Billeteras","source":"$2a"}
// source field is always a quoted string: either "$<refId>" or inline "<svg...>"

const icons = []
// Dedup key is (type, id) — same id in different categories is legitimate (e.g. "JPM" in CEDEARs and Bancos y Billeteras)
const seen = new Set()
let searchPos = 0

while (true) {
  const titleIdx = flight.indexOf('"_title":', searchPos)
  if (titleIdx === -1) break

  // Get the containing object by looking for the opening { before _title
  const objStart = flight.lastIndexOf("{", titleIdx)
  if (objStart === -1) { searchPos = titleIdx + 1; continue }

  // A window large enough to cover the largest inline SVG (some are ~5KB)
  const objSlice = flight.slice(objStart, objStart + 8000)

  const titleM = objSlice.match(/"_title"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  const idM = objSlice.match(/"id"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  const typeM = objSlice.match(/"type"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  // source is always a JSON-quoted string value (either "$ref" or inline svg)
  const sourceM = objSlice.match(/"source"\s*:\s*"((?:[^"\\]|\\.)*)"/)

  if (!titleM || !idM || !typeM || !sourceM) { searchPos = titleIdx + 1; continue }

  let title, id, type
  try {
    title = JSON.parse(`"${titleM[1]}"`)
    id    = JSON.parse(`"${idM[1]}"`)
    type  = JSON.parse(`"${typeM[1]}"`)
  } catch { searchPos = titleIdx + 1; continue }

  const rawSource = sourceM[1]

  // Resolve source
  let svgContent = null

  if (rawSource.startsWith("$")) {
    // Reference token: "$2a" → refs["2a"]
    const refKey = rawSource.slice(1)
    svgContent = refs[refKey] ?? null
    if (!svgContent) {
      console.warn(`    [WARN] Unresolved ref "$${refKey}" for id="${id}" type="${type}" title="${title}"`)
    }
  } else {
    // Inline JSON-escaped SVG. The raw capture may have leading whitespace escapes (e.g. "\n<svg...")
    // Decode first, then check content.
    let decoded = rawSource
    try {
      decoded = JSON.parse(`"${rawSource}"`)
    } catch {
      // Use as-is if JSON decode fails
    }
    const trimmed = decoded.trim()
    if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml") || trimmed.startsWith("<path")) {
      svgContent = decoded
    } else if (!rawSource.startsWith("$")) {
      // Not a ref and not recognized SVG — warn loudly
      console.warn(`    [WARN] Unrecognized source for id="${id}" type="${type}" title="${title}": ${rawSource.slice(0, 60)}`)
    }
  }

  // Dedup key: type + id (same id is allowed across different categories)
  const dedupKey = `${type}\0${id}`
  if (svgContent && !seen.has(dedupKey)) {
    seen.add(dedupKey)
    icons.push({ id, title, type, svgContent })
  }

  searchPos = titleIdx + 1
}

console.log(`    ${icons.length} icons found before validation`)

// ── Step 5: sanitize and write SVGs ──────────────────────────────────────────

console.log("[5/6] Writing SVG files …")

// Ensure directories exist (clear existing SVGs to avoid orphans from prior runs)
fs.mkdirSync(PUBLIC_AR, { recursive: true })
for (const slug of Object.values(CATEGORY_SLUGS)) {
  const dir = path.join(PUBLIC_AR, slug)
  fs.mkdirSync(dir, { recursive: true })
  // Remove stale SVGs from previous runs
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".svg")) fs.rmSync(path.join(dir, f))
  }
}

function sanitizeSvg(raw) {
  if (typeof raw !== "string") return null
  let trimmed = raw.trim()
  // Strip XML declaration if present (browsers don't need it for <img> tag)
  if (trimmed.startsWith("<?xml")) {
    const svgStart = trimmed.indexOf("<svg")
    if (svgStart === -1) return null
    trimmed = trimmed.slice(svgStart)
  }
  if (!trimmed.startsWith("<svg")) return null
  // Trim to the last </svg> close
  const svgEnd = trimmed.lastIndexOf("</svg>")
  if (svgEnd === -1) return null
  trimmed = trimmed.slice(0, svgEnd + 6)
  // Strip <script> blocks (security)
  const clean = trimmed.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  return clean
}

const catalog = []
const failedParse = []
const countByCategory = {}
const unknownCategories = new Set()
// Track filenames used within each category to avoid within-category id collisions
const usedFilenames = {}  // categorySlug → Set of filenames (without .svg)

for (const icon of icons) {
  const categorySlug = CATEGORY_SLUGS[icon.type]
  if (!categorySlug) {
    unknownCategories.add(icon.type)
    continue
  }

  const svg = sanitizeSvg(icon.svgContent)
  if (!svg) {
    failedParse.push({ id: icon.id, type: icon.type, preview: String(icon.svgContent).slice(0, 60) })
    continue
  }

  // Disambiguate filename if there's a within-category id collision
  if (!usedFilenames[categorySlug]) usedFilenames[categorySlug] = new Set()
  let filename = icon.id
  if (usedFilenames[categorySlug].has(filename)) {
    // Append -2, -3, etc. until unique
    let suffix = 2
    while (usedFilenames[categorySlug].has(`${filename}-${suffix}`)) suffix++
    const newFilename = `${filename}-${suffix}`
    console.warn(`    [WARN] Within-category id collision: "${filename}" in ${categorySlug} → renamed to "${newFilename}" for title="${icon.title}"`)
    filename = newFilename
  }
  usedFilenames[categorySlug].add(filename)

  const filePath = path.join(PUBLIC_AR, categorySlug, `${filename}.svg`)
  fs.writeFileSync(filePath, svg, "utf8")

  const publicPath = `/icons/ar/${categorySlug}/${filename}.svg`
  catalog.push({
    id: icon.id,
    title: icon.title,
    category: icon.type,
    path: publicPath,
  })

  countByCategory[icon.type] = (countByCategory[icon.type] ?? 0) + 1
}

// ── Step 6: write catalog and notice ─────────────────────────────────────────

console.log("[6/6] Writing catalog and attribution …")

// Sort: category order first, then alphabetically by title within each
const categoryIndex = Object.fromEntries(CATEGORY_ORDER.map((c, i) => [c, i]))
catalog.sort((a, b) => {
  const ci = (categoryIndex[a.category] ?? 99) - (categoryIndex[b.category] ?? 99)
  if (ci !== 0) return ci
  return a.title.localeCompare(b.title, "es")
})

// Build TypeScript catalog
const entriesTs = catalog
  .map(
    (e) =>
      `  { id: ${JSON.stringify(e.id)}, title: ${JSON.stringify(e.title)}, category: ${JSON.stringify(e.category)}, path: ${JSON.stringify(e.path)} },`
  )
  .join("\n")

const categoriesTs = CATEGORY_ORDER.map((c) => {
  const slug = CATEGORY_SLUGS[c]
  return `  { id: ${JSON.stringify(slug)}, label: ${JSON.stringify(c)} },`
}).join("\n")

const tsContent = `// AUTO-GENERATED by scripts/fetch-ar-fintech-icons.mjs — DO NOT EDIT MANUALLY
// Source: https://icons.com.ar/ — logos and brands belong to their respective owners.
// See public/icons/ar/NOTICE.md for full attribution.

export interface ArFintechIcon {
  id: string
  title: string
  category: string
  path: string
}

export interface ArIconCategory {
  id: string
  label: string
}

export const AR_ICON_CATEGORIES: ArIconCategory[] = [
${categoriesTs}
]

export const AR_FINTECH_ICONS: ArFintechIcon[] = [
${entriesTs}
]
`

fs.writeFileSync(CATALOG_PATH, tsContent, "utf8")

// Attribution notice
const notice = `# Íconos AR Fintech — Atribución

Íconos de [icons.com.ar](https://icons.com.ar/)
([github.com/sgalanb/fintech-icons-argentina](https://github.com/sgalanb/fintech-icons-argentina)).

Logos y marcas son propiedad de sus respectivos dueños.
Su uso en esta aplicación es referencial y sin fines comerciales.
`
fs.writeFileSync(path.join(PUBLIC_AR, "NOTICE.md"), notice, "utf8")

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n── Summary ──────────────────────────────────────────────")
for (const cat of CATEGORY_ORDER) {
  const slug = CATEGORY_SLUGS[cat]
  const count = countByCategory[cat] ?? 0
  console.log(`  ${cat.padEnd(25)} (${slug}): ${count} icons`)
}
console.log(`  ${"TOTAL".padEnd(25)}    : ${catalog.length} icons`)
if (unknownCategories.size > 0) {
  console.log(`\n  Unknown categories (skipped): ${[...unknownCategories].join(", ")}`)
}
if (failedParse.length > 0) {
  console.log(`\n  Failed SVG sanitization (${failedParse.length}):`)
  for (const f of failedParse.slice(0, 10)) {
    console.log(`    [${f.type}] ${f.id}: ${f.preview}`)
  }
  if (failedParse.length > 10) console.log(`    … and ${failedParse.length - 10} more`)
}
console.log("\n  Catalog → src/lib/ar-fintech-icons.ts")
console.log("  Attribution → public/icons/ar/NOTICE.md")
console.log("─────────────────────────────────────────────────────────\n")

if (catalog.length < 100) {
  console.error("ERROR: Extracted fewer than 100 icons. Parsing may be broken.")
  process.exit(1)
}
