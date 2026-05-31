/**
 * fetch-crypto-icons.mjs
 *
 * Fetches cryptocurrency icons from the CC0-licensed spothq/cryptocurrency-icons repo.
 * Downloads color SVGs to public/icons/crypto/<SYMBOL>.svg.
 * Appends crypto entries to src/lib/ar-fintech-icons.ts.
 * Writes public/icons/crypto/NOTICE.md.
 *
 * Source: https://github.com/spothq/cryptocurrency-icons — CC0 1.0 (public domain).
 * Run: node scripts/fetch-crypto-icons.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const PUBLIC_CRYPTO = path.join(ROOT, "public", "icons", "crypto")
const CATALOG_PATH = path.join(ROOT, "src", "lib", "ar-fintech-icons.ts")

const MANIFEST_URL =
  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/manifest.json"
const SVG_BASE =
  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color"

// Small concurrency to be polite
const CONCURRENCY = 5
const DELAY_MS = 50

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res
    if (res.status === 404) return null // definitive miss
    if (attempt < retries) await sleep(500)
  }
  return null
}

// Run tasks in batches of `concurrency`
async function runBatched(items, concurrency, fn) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    if (i + concurrency < items.length) await sleep(DELAY_MS)
  }
  return results
}

// ── Step 1: fetch manifest ────────────────────────────────────────────────────

console.log("[1/4] Fetching manifest.json …")
const manifestRes = await fetch(MANIFEST_URL)
if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status} fetching manifest`)
const manifest = await manifestRes.json()
console.log(`    ${manifest.length} entries in manifest (before dedup)`)

// Deduplicate by uppercase symbol (some manifests contain duplicate entries)
const seen = new Set()
const deduped = manifest.filter((entry) => {
  const key = entry.symbol.toUpperCase()
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
if (deduped.length < manifest.length) {
  console.log(`    Deduped to ${deduped.length} unique symbols (removed ${manifest.length - deduped.length} duplicates)`)
}
manifest.splice(0, manifest.length, ...deduped)

// ── Step 2: ensure output directory ──────────────────────────────────────────

fs.mkdirSync(PUBLIC_CRYPTO, { recursive: true })

// ── Step 3: download SVGs ─────────────────────────────────────────────────────

console.log("[2/4] Downloading SVGs …")

let downloaded = 0
let skipped = 0

const successfulEntries = [] // { symbol, name }

const results = await runBatched(manifest, CONCURRENCY, async (entry) => {
  const symbolLower = entry.symbol.toLowerCase()
  const symbolUpper = entry.symbol.toUpperCase()
  const url = `${SVG_BASE}/${symbolLower}.svg`
  const destPath = path.join(PUBLIC_CRYPTO, `${symbolUpper}.svg`)

  const res = await fetchWithRetry(url)
  if (!res) {
    console.warn(`    SKIP ${symbolUpper}: SVG not found at ${url}`)
    return { ok: false, symbol: symbolUpper }
  }

  const svg = await res.text()
  // Basic sanity: must look like SVG
  if (!svg.trim().startsWith("<") || !svg.includes("svg")) {
    console.warn(`    SKIP ${symbolUpper}: response doesn't look like SVG`)
    return { ok: false, symbol: symbolUpper }
  }

  fs.writeFileSync(destPath, svg, "utf8")
  return { ok: true, symbol: symbolUpper, name: entry.name }
})

for (const r of results) {
  if (r.ok) {
    downloaded++
    successfulEntries.push({ symbol: r.symbol, name: r.name })
  } else {
    skipped++
  }
}

console.log(`    Downloaded: ${downloaded}, Skipped: ${skipped}`)

// ── Step 4: write NOTICE.md ──────────────────────────────────────────────────

console.log("[3/4] Writing NOTICE.md …")
const notice = `# Cryptocurrency Icons — NOTICE

Cryptocurrency icons por [spothq/cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons) — licencia CC0 1.0 (dominio público).

No se requiere atribución. Libre para uso comercial.
`
fs.writeFileSync(path.join(PUBLIC_CRYPTO, "NOTICE.md"), notice, "utf8")

// ── Step 5: update ar-fintech-icons.ts ──────────────────────────────────────

console.log("[4/4] Updating ar-fintech-icons.ts …")

const currentContent = fs.readFileSync(CATALOG_PATH, "utf8")

// Check if Cripto category already exists — if so, remove old crypto entries to regenerate
const alreadyHasCripto = currentContent.includes('"Cripto"')

let baseContent = currentContent

if (alreadyHasCripto) {
  console.log("    Cripto entries already present — replacing them …")
  // Remove all lines that contain category: "Cripto" (one entry per line in the catalog)
  baseContent = currentContent
    .split("\n")
    .filter((line) => !line.includes('category: "Cripto"'))
    .join("\n")
}

// Remove the closing array bracket ] and the Cripto category from AR_ICON_CATEGORIES if present
// We'll rebuild both sections

// 1. Update AR_ICON_CATEGORIES — add "Cripto" after "monedas" if not already there
let updatedContent = baseContent

if (!updatedContent.includes('{ id: "cripto"')) {
  updatedContent = updatedContent.replace(
    /(\{ id: "monedas", label: "Monedas" \},?\n)/,
    `$1  { id: "cripto", label: "Cripto" },\n`
  )
}

// 2. Build crypto entries block
const cryptoLines = successfulEntries.map(
  ({ symbol, name }) =>
    `  { id: "crypto-${symbol.toLowerCase()}", title: "${name}", category: "Cripto", path: "/icons/crypto/${symbol}.svg" },`
)

// 3. Append before the closing ] of AR_FINTECH_ICONS
// The file ends with: ]\n  (trailing newline)
updatedContent = updatedContent.replace(
  /\n\]\n?$/,
  "\n" + cryptoLines.join("\n") + "\n]\n"
)

fs.writeFileSync(CATALOG_PATH, updatedContent, "utf8")

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("")
console.log("=== Summary ===")
console.log(`  Manifest entries:  ${manifest.length}`)
console.log(`  SVGs downloaded:   ${downloaded}`)
console.log(`  SVGs skipped:      ${skipped}`)
console.log(`  Total crypto icons in catalog: ${downloaded}`)
console.log(`  Output directory:  public/icons/crypto/`)
console.log(`  Catalog updated:   src/lib/ar-fintech-icons.ts`)
console.log("")
