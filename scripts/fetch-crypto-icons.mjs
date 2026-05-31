/**
 * fetch-crypto-icons.mjs
 *
 * Fetches cryptocurrency icons from the CC0-licensed spothq/cryptocurrency-icons repo.
 * Downloads color SVGs to public/icons/crypto/<SYMBOL>.svg.
 * Each SVG is transformed into a full-bleed square tile (circle → rect) so it
 * matches the bank-logo app-icon look (rounded corners are applied in CSS).
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

// ── SVG squareification ───────────────────────────────────────────────────────
//
// Transforms a round-coin SVG into a full-bleed square tile:
//   (a) If a background <circle> is detected (cx≈half, cy≈half, r≈half of viewBox),
//       replace it with <rect x="0" y="0" width="W" height="H" fill="<circle fill>"/>
//   (b) Otherwise, prepend a backmost <rect> using the manifest color (fallback #1F2937)
//       as the first child inside the root <svg> (or first outermost <g>).
//
// Returns { svg: string, method: "circle-replace" | "color-rect-prepend" | "parse-error" }

function squareifySvg(svgText, manifestColor) {
  const fallbackColor = manifestColor || "#1F2937"

  // Parse viewBox — default to "0 0 32 32"
  const vbMatch = svgText.match(/viewBox=["']([^"']+)["']/)
  let vbw = 32, vbh = 32
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/)
    if (parts.length === 4) {
      vbw = parseFloat(parts[2]) || 32
      vbh = parseFloat(parts[3]) || 32
    }
  }

  const halfW = vbw / 2
  const halfH = vbh / 2
  // Allow 10% tolerance for "approximately half"
  const toleranceW = halfW * 0.1
  const toleranceH = halfH * 0.1

  // Try to detect and replace the background circle.
  // Match a <circle .../> that isn't self-closing with whitespace variations.
  // We look for cx, cy, r attributes (in any order) that match the full-background circle.
  const circleRegex = /<circle([^>]*?)\/>/g
  let match
  let replaced = false
  let resultSvg = svgText

  while ((match = circleRegex.exec(svgText)) !== null) {
    const attrs = match[1]

    const cxM = attrs.match(/\bcx=["']([^"']+)["']/)
    const cyM = attrs.match(/\bcy=["']([^"']+)["']/)
    const rM  = attrs.match(/\br=["']([^"']+)["']/)

    if (!cxM || !cyM || !rM) continue

    const cx = parseFloat(cxM[1])
    const cy = parseFloat(cyM[1])
    const r  = parseFloat(rM[1])

    // Check it's a full-background circle
    const isCenterX = Math.abs(cx - halfW) <= toleranceW
    const isCenterY = Math.abs(cy - halfH) <= toleranceH
    const isFullRadius = Math.abs(r - halfW) <= toleranceW || Math.abs(r - halfH) <= toleranceH

    if (!isCenterX || !isCenterY || !isFullRadius) continue

    // Extract the fill color from this circle's attributes
    const fillM = attrs.match(/\bfill=["']([^"']+)["']/)
    const circleFill = fillM ? fillM[1] : fallbackColor

    const rect = `<rect x="0" y="0" width="${vbw}" height="${vbh}" fill="${circleFill}"/>`
    resultSvg = svgText.slice(0, match.index) + rect + svgText.slice(match.index + match[0].length)
    replaced = true
    break
  }

  if (replaced) {
    return { svg: resultSvg, method: "circle-replace" }
  }

  // Fallback: prepend a backmost rect as the first child inside <svg> or first <g>
  const rect = `<rect x="0" y="0" width="${vbw}" height="${vbh}" fill="${fallbackColor}"/>`

  // Try inserting after the opening <svg ...> tag
  const svgTagMatch = svgText.match(/<svg[^>]*>/)
  if (svgTagMatch) {
    const insertPos = svgTagMatch.index + svgTagMatch[0].length
    resultSvg = svgText.slice(0, insertPos) + rect + svgText.slice(insertPos)
    return { svg: resultSvg, method: "color-rect-prepend" }
  }

  // Couldn't transform — return original with a warning flag
  return { svg: svgText, method: "parse-error" }
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

// Build symbol → color map for the fallback rect
const colorMap = {}
for (const entry of manifest) {
  colorMap[entry.symbol.toUpperCase()] = entry.color || null
}

// ── Step 2: ensure output directory ──────────────────────────────────────────

fs.mkdirSync(PUBLIC_CRYPTO, { recursive: true })

// ── Step 3: download SVGs ─────────────────────────────────────────────────────

console.log("[2/4] Downloading SVGs …")

let downloaded = 0
let skipped = 0
let squareCircleReplace = 0
let squareColorPrepend = 0
let squareParseError = 0

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

  const rawSvg = await res.text()
  // Basic sanity: must look like SVG
  if (!rawSvg.trim().startsWith("<") || !rawSvg.includes("svg")) {
    console.warn(`    SKIP ${symbolUpper}: response doesn't look like SVG`)
    return { ok: false, symbol: symbolUpper }
  }

  const { svg, method } = squareifySvg(rawSvg, colorMap[symbolUpper])

  if (method === "parse-error") {
    console.error(`    PARSE-ERROR ${symbolUpper}: could not squareify — writing original`)
  }

  fs.writeFileSync(destPath, svg, "utf8")
  return { ok: true, symbol: symbolUpper, name: entry.name, squareMethod: method }
})

for (const r of results) {
  if (r.ok) {
    downloaded++
    successfulEntries.push({ symbol: r.symbol, name: r.name })
    if (r.squareMethod === "circle-replace") squareCircleReplace++
    else if (r.squareMethod === "color-rect-prepend") squareColorPrepend++
    else squareParseError++
  } else {
    skipped++
  }
}

console.log(`    Downloaded: ${downloaded}, Skipped: ${skipped}`)
console.log(`    Squareified via circle-replace: ${squareCircleReplace}`)
console.log(`    Squareified via color-rect-prepend: ${squareColorPrepend}`)
if (squareParseError > 0) {
  console.error(`    PARSE ERRORS (wrote original): ${squareParseError}`)
}

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
console.log(`  Squareified (circle-replace):    ${squareCircleReplace}`)
console.log(`  Squareified (color-rect-prepend): ${squareColorPrepend}`)
if (squareParseError > 0) {
  console.error(`  PARSE ERRORS (not squareified):  ${squareParseError}`)
}
console.log(`  Total crypto icons in catalog: ${downloaded}`)
console.log(`  Output directory:  public/icons/crypto/`)
console.log(`  Catalog updated:   src/lib/ar-fintech-icons.ts`)
console.log("")
