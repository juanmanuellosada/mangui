#!/usr/bin/env node
/**
 * generate-branding.mjs
 *
 * Redesigns the mangui logo and generates all brand assets using
 * Google's Gemini image generation model (gemini-2.5-flash-image).
 *
 * The existing logo.png (repo root) is passed as an input reference image
 * so the model redesigns in the same spirit: a cheerful mango wearing dark
 * sunglasses with a money cue (dollar bill / coin), playful but trustworthy
 * fintech identity. Output is cleaner, more premium, flat/vector-style.
 *
 * Usage:
 *   node scripts/generate-branding.mjs [--only icon-master,og-image] [--no-ref] [--out brand]
 *
 * Requires GEMINI_API_KEY in environment or .env.local (GEMINI_API_KEY=...).
 * Needs Gemini paid/billing tier — 429 responses indicate quota/billing issues.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Environment: read GEMINI_API_KEY from process.env or .env.local fallback
// ---------------------------------------------------------------------------
function loadApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GEMINI_API_KEY=')) {
        const value = trimmed.slice('GEMINI_API_KEY='.length).trim();
        if (value) return value;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    only: null,    // Set<string> | null (all)
    noRef: false,  // --no-ref: skip reference image, use pure prompt
    out: 'brand',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only' && args[i + 1]) {
      opts.only = new Set(args[++i].split(',').map(s => s.trim()));
    } else if (args[i] === '--no-ref') {
      opts.noRef = true;
    } else if (args[i] === '--out' && args[i + 1]) {
      opts.out = args[++i];
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Brand palette preamble baked into every prompt
// ---------------------------------------------------------------------------
const BRAND_PREAMBLE = `
Brand identity context for mangui (apply strictly):
- App concept: playful-premium personal finance app for Argentina. The mascot is a CHEERFUL MANGO character wearing dark sunglasses — always paired with a money cue (a dollar bill, a gold coin, or a small stack of bills). This is the CORE identity: mango + sunglasses + money. Do NOT drop the sunglasses. Do NOT make it generic fruit.
- Palette: primary lime-green #84CC16 (highlight) / #65A30D (deep); accent mango-orange #F97316; warm near-white background #FAFAF9; deep teal-charcoal #0B1410.
- Style: CLEAN FLAT VECTOR art. Crisp edges, bold shapes, minimal shading (at most subtle drop shadows or soft gradients). NO photorealistic rendering. NO detailed textures. NO watercolor. Think premium app icon illustration — the kind you'd find on the App Store for a well-funded fintech startup.
- Character personality: friendly, cheerful, confident. The sunglasses read "cool" not "shady". The money cue reads "I understand money" not "greedy".
- Anti-slop: NO AI purple/blue gradients. NO generic coin-stack clip-art. NO banking imagery (safes, vaults, columns). NO random sparkle effects. NO complex backgrounds that distract from the character.
`.trim();

// ---------------------------------------------------------------------------
// ASSETS definition
// ---------------------------------------------------------------------------
const ASSETS = [
  {
    id: 'icon-master',
    useRef: true,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate a premium APP ICON for mangui.

FORMAT: Square (1024×1024 visual scale). iOS-style rounded-square icon shape — the artwork fills the square canvas edge-to-edge (the OS applies corner rounding; do NOT paint rounded corners yourself, just fill the square). Centered composition with generous internal padding (~15% on each side) so the character is never clipped.

ARTWORK:
- The mango character: a cheerful ripe mango body (warm orange-yellow gradient from #F97316 to #FBBF24), with two dark round sunglasses lenses (near-black, subtle reflection highlight), a small confident smile, and two simple arms/hands. One hand holds or displays a crisp green dollar bill (simplified flat vector bill — green rectangle with "$" text) or tucks a bill under its arm. The character looks friendly and self-assured.
- The character occupies roughly the central 70% of the canvas.

BACKGROUND: A bold brand gradient — either lime #84CC16 at top-left → teal #0B1410 at bottom-right, OR a lime #65A30D → orange #F97316 diagonal gradient. The gradient should feel premium, not garish. No complex patterns or textures behind the character.

STYLE: Flat vector illustration, clean crisp outlines (2–3px stroke weight implied by the shapes), bold fills, minimal detail. Render at maximum quality as if this will be shrunk to 60×60px — shapes must read clearly at small sizes.

NO text, no wordmark. Just the character on the gradient background.`,
  },
  {
    id: 'logomark',
    useRef: true,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate the mangui LOGOMARK — just the mango-with-sunglasses character, isolated on plain white, for easy background removal and use on any surface.

FORMAT: Square canvas. PLAIN WHITE (#FFFFFF) background — solid, no gradient, no shadow on the background itself. Very generous padding (~20% on each side) so the character floats comfortably.

ARTWORK:
- The mango character: a cheerful ripe mango body (warm orange-yellow, flat vector), dark sunglasses, small confident smile, two simple arms. The character holds or displays a small flat-vector dollar bill (simplified green rectangle with a "$" symbol) — visible but not dominant.
- CLEAN OUTLINE: thin uniform stroke (same dark color, ~2px implied weight) around all major shapes so the character reads well when placed on colored backgrounds.
- Slight cast shadow directly below the character (very subtle, short — like a simple ellipse in light gray at 20% opacity) to give it grounding without making it hard to extract.

STYLE: Flat vector, crisp, bold shapes. Zero background decoration. This is the master logomark file.

NO text, no gradients on the background, nothing touching the edges of the canvas.`,
  },
  {
    id: 'logo-horizontal-light',
    useRef: true,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate the mangui HORIZONTAL LOGO LOCKUP for light backgrounds.

FORMAT: Wide rectangle (roughly 3:1 width:height ratio). Background: warm near-white #FAFAF9 — solid, clean. Generous padding on all sides (at least 15% of height on top/bottom, 12% of width on left/right).

COMPOSITION: The logomark (mango character with sunglasses and dollar bill) on the LEFT, vertically centered. To the RIGHT of the logomark, the wordmark "mangui" in a friendly rounded bold sans-serif typeface (think Nunito, Poppins, or similar rounded geometric — lowercase, heavy weight, 700–800). Spacing between logomark and wordmark: roughly equal to one character-width gap. Both elements vertically centered relative to each other.

WORDMARK STYLE: Lowercase "mangui". Color: deep teal-charcoal #0B1410 for most letters. The letter "i" (or the dot above it) rendered in mango-orange #F97316 as a subtle brand accent — just that one element pops. Letterforms must be crisp and readable.

LOGOMARK: Same mango character as the logomark asset — flat, vector-style, friendly, sunglasses + dollar bill. Scaled so its height matches approximately 1.2× the cap-height of the wordmark.

STYLE: Clean, professional, balanced. This is the primary logo for use on white/light backgrounds (website header, light-mode UI, documents).

NO gradient background. NO shadow on the background. NO extra decorative elements.`,
  },
  {
    id: 'logo-horizontal-dark',
    useRef: true,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate the mangui HORIZONTAL LOGO LOCKUP for dark backgrounds.

FORMAT: Wide rectangle (roughly 3:1 width:height ratio). Background: deep teal-charcoal #0B1410 — solid, clean. Generous padding on all sides (at least 15% of height top/bottom, 12% of width left/right).

COMPOSITION: Identical layout to the light version — logomark LEFT, wordmark RIGHT, vertically centered.

WORDMARK STYLE: Lowercase "mangui" in the same rounded bold sans-serif. Color: warm near-white #FAFAF9 (off-white, not pure white — so it reads as branded). The letter "i" (or its dot) in mango-orange #F97316 as the accent.

LOGOMARK: Same mango character — flat vector, sunglasses + dollar bill. On a dark background the character's outline stroke should be slightly lighter (maybe rendered in near-white or a subtle lime stroke) so it reads clearly against #0B1410.

STYLE: Clean, premium dark-mode lockup. This is used in the app's dark navbar, dark hero sections, and dark marketing materials.

NO gradient on the background. NO glow. NO extra decorative elements.`,
  },
  {
    id: 'wordmark',
    useRef: false,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate the mangui WORDMARK — just the typographic logotype, no character illustration.

FORMAT: Wide rectangle (roughly 4:1 or 5:1 width:height ratio). Background: solid white (#FFFFFF). Generous padding.

ARTWORK: The single lowercase word "mangui" in a friendly rounded bold sans-serif typeface (Nunito / Poppins / Fredoka-style — rounded, geometric, confident). Weight: 700–800 (heavy but not black). The wordmark should feel premium yet approachable.

COLOR:
- Letters "m", "a", "n", "g", "u": lime-green #65A30D (the deeper brand green).
- The final letter "i" AND its dot: mango-orange #F97316 — this is the single accent that ties wordmark to the mango mascot concept. The transition from green to orange should be clean and intentional, not gradient-blended.

STYLE: Crisp vector-quality rendering. Optically even letter-spacing. No shadows, no 3D, no embellishment. Just the letters, centered in the canvas.

This is used standalone in contexts where the full lockup won't fit (favicons, tiny badges, embroidery, etc.).`,
  },
  {
    id: 'og-image',
    useRef: true,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate a social/OpenGraph share image for mangui.

FORMAT: Landscape 1200×630 (approximately 1.91:1 ratio). This will appear as the preview image when mangui links are shared on Twitter/X, WhatsApp, LinkedIn, iMessage, etc.

COMPOSITION:
- Background: deep teal-charcoal #0B1410. A very subtle lime→teal gradient wash (not garish — think 10–15% gradient opacity over the flat background) adds depth.
- LEFT SIDE (~40% width): The mango character (mascot) — flat vector, cheerful, sunglasses + dollar bill, scaled large enough to be expressive. The character is slightly cropped at the bottom (shows from roughly mid-torso up) giving it an editorial "emerging" feel. The character is the emotional hook.
- CENTER-RIGHT (~55% width): Editorial copy block, vertically centered:
  - Small label above headline: "mangui" wordmark (the rounded bold sans logotype in lime #84CC16, small — ~18px equivalent).
  - Main headline in a friendly display font (Calistoga-style, or heavy rounded sans): TWO LINES, white text, large (~48px equivalent):
    Line 1: "Controlá tu plata"
    Line 2: "en pesos y dólares."
  - Subheadline below (IBM Plex Sans or similar, 300 weight, ~18px, muted near-white at 70% opacity, max 50 characters per line):
    "La app de finanzas personales"
    "para argentinos."
  - Small CTA badge at the bottom: rounded pill shape, lime background #65A30D, white text "Gratis · Sin tarjeta" (~14px, caps or small-caps).
- RIGHT EDGE: a subtle vertical lime accent stripe (~4px wide) OR a very faint mango-orange gradient bleed at the right edge — optional but adds polish.

BREATHING ROOM: generous padding. Nothing within 40px of any edge. Text is readable at 600×315 (half size — this is the minimum preview size).

STYLE: Premium fintech OG card. Dark, bold, trustworthy. NOT cluttered. The character adds playfulness; the copy anchors seriousness.`,
  },
  {
    id: 'mascot',
    useRef: true,
    prompt: `${BRAND_PREAMBLE}

TASK: Generate the mangui MASCOT illustration — the full mango character, expressive and standalone, for use in empty-states, onboarding screens, marketing pages, and illustrations.

FORMAT: Square canvas. PLAIN WHITE (#FFFFFF) background — absolutely clean. Very generous padding (~15–20% on each side). The character should be tall (portrait orientation within the square) to feel like a proper character illustration, not just an icon.

ARTWORK:
- FULL BODY CHARACTER: The mango character shown from head to feet (or a very short stub base). Body: a plump, cheerful ripe mango shape in warm orange-yellow (#F97316 to #FBBF24 subtle gradient, flat-ish). Arms: two simple round arms, slightly outstretched in a welcoming or celebratory pose (e.g., one arm raised with thumb-up, or both arms slightly open in a "welcome" gesture).
- FACE: Dark round sunglasses (the signature accessory — essential), small friendly smile (a simple curved line), no other facial features needed (keep it simple/iconic).
- MONEY CUE: The character holds a small flat-vector green dollar bill in one hand. The bill is simplified — a green rectangle with a white "$" — not realistic currency.
- FEET/BASE: Small simple rounded feet or a short circular base so the character stands. Does NOT need to be a full realistic foot.
- OPTIONAL DETAIL: A small leaf or stem at the top of the mango body (typical mango crown — makes it clearly read as a mango and not just a blob). Keep it simple.

EXPRESSION / POSE: Confident, friendly, approachable. Like a mascot you'd see in a fintech onboarding screen saying "Welcome! Let's sort your finances."

STYLE: Flat vector illustration, clean uniform stroke weight, bold fills. Character must be expressive at small sizes (128×128px or less). No background details, no cast environment shadow, no decorative elements.

This is the MASTER MASCOT FILE — it will be scaled, recolored, and reused extensively. Clarity and simplicity are paramount.`,
  },
];

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const INTER_REQUEST_DELAY_MS = 4000; // 4s between requests to respect rate limits

async function generateImage(apiKey, prompt, referenceImageBase64) {
  const parts = [];

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: referenceImageBase64,
      },
    });
  }

  parts.push({ text: prompt });

  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  return response;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
  const kb = Math.round(bytes / 1024);
  return `${kb}KB`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv);

  // Load API key
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error(
      '\nERROR: GEMINI_API_KEY not found.\n' +
        'Set it in your environment:\n' +
        '  export GEMINI_API_KEY=your_key_here\n' +
        'Or add it to .env.local in the project root:\n' +
        '  GEMINI_API_KEY=your_key_here\n' +
        '\nNote: Gemini image generation requires a paid/billing-enabled account.\n'
    );
    process.exit(1);
  }

  // Load reference image (logo.png at repo root) unless --no-ref
  let referenceImageBase64 = null;
  if (!opts.noRef) {
    const logoPath = path.join(PROJECT_ROOT, 'logo.png');
    if (fs.existsSync(logoPath)) {
      referenceImageBase64 = fs.readFileSync(logoPath).toString('base64');
      console.log(`  Reference  : logo.png loaded (${formatBytes(fs.statSync(logoPath).size)})`);
    } else {
      console.warn(`  WARNING: logo.png not found at ${logoPath} — proceeding without reference image.`);
      console.warn(`  TIP: Run with --no-ref to suppress this warning.\n`);
    }
  }

  // Filter assets
  let assets = ASSETS;
  if (opts.only) {
    assets = assets.filter(a => opts.only.has(a.id));
    if (assets.length === 0) {
      console.error(
        `ERROR: No assets matched --only filter.\n` +
          `Available ids: ${ASSETS.map(a => a.id).join(', ')}`
      );
      process.exit(1);
    }
  }

  // Ensure output directory exists
  const outDir = path.resolve(PROJECT_ROOT, opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\nmangui branding generator`);
  console.log(`  Output dir : ${outDir}`);
  console.log(`  Assets     : ${assets.length} (of ${ASSETS.length} total)`);
  console.log(`  Reference  : ${opts.noRef ? 'disabled (--no-ref)' : referenceImageBase64 ? 'logo.png' : 'not found'}`);
  console.log(`  Endpoint   : ${GEMINI_ENDPOINT}\n`);

  const results = { succeeded: [], failed: [] };

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const useRefForThisAsset = asset.useRef && !opts.noRef && referenceImageBase64 !== null;
    const refLabel = useRefForThisAsset ? '+ref' : 'no-ref';
    const label = `[${i + 1}/${assets.length}] ${asset.id} (${refLabel})`;

    process.stdout.write(`${label} … `);

    try {
      const refData = useRefForThisAsset ? referenceImageBase64 : null;
      const response = await generateImage(apiKey, asset.prompt, refData);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 'unknown';
        console.log(`429 quota/billing — skipping. (retry-after: ${retryAfter}s)`);
        console.log(
          `  HINT: 429 means billing is not enabled or quota is exhausted.\n` +
            `  Enable billing at https://console.cloud.google.com/billing and try again.`
        );
        results.failed.push({ id: asset.id, reason: '429 quota/billing' });
        if (i < assets.length - 1) await sleep(INTER_REQUEST_DELAY_MS);
        continue;
      }

      if (!response.ok) {
        const bodyText = await response.text();
        console.log(`HTTP ${response.status} error`);
        console.error(`  Body (first 200 chars): ${bodyText.slice(0, 200)}`);
        results.failed.push({ id: asset.id, reason: `HTTP ${response.status}` });
        if (i < assets.length - 1) await sleep(INTER_REQUEST_DELAY_MS);
        continue;
      }

      const json = await response.json();

      // Extract inlineData from the response
      const candidates = json.candidates || [];
      let imageData = null;
      let mimeType = 'image/png';

      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'image/png';
            break;
          }
        }
        if (imageData) break;
      }

      if (!imageData) {
        console.log(`no image data in response`);
        const responseStr = JSON.stringify(json).slice(0, 200);
        console.error(`  Response preview: ${responseStr}`);
        results.failed.push({ id: asset.id, reason: 'no inlineData in response' });
        if (i < assets.length - 1) await sleep(INTER_REQUEST_DELAY_MS);
        continue;
      }

      // Decode base64 and write PNG
      const imageBuffer = Buffer.from(imageData, 'base64');
      const ext = mimeType.includes('png') ? 'png' : mimeType.split('/')[1] || 'png';
      const filename = `${asset.id}.${ext}`;
      const outPath = path.join(outDir, filename);

      fs.writeFileSync(outPath, imageBuffer);
      const sizeStr = formatBytes(imageBuffer.length);
      console.log(`saved ${sizeStr} → ${filename}`);
      results.succeeded.push({ id: asset.id, filename, size: imageBuffer.length });

    } catch (err) {
      console.log(`error — ${err.message}`);
      results.failed.push({ id: asset.id, reason: err.message });
    }

    // Delay between requests (skip after last one)
    if (i < assets.length - 1) {
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  // Summary
  console.log('\n─────────────────────────────────────');
  console.log(`  DONE  ${results.succeeded.length} succeeded · ${results.failed.length} failed`);
  if (results.succeeded.length > 0) {
    console.log(`  Saved to: ${outDir}/`);
    console.log(`  Assets saved:`);
    for (const s of results.succeeded) {
      console.log(`    • ${s.filename} (${formatBytes(s.size)})`);
    }
  }
  if (results.failed.length > 0) {
    console.log(`  Failed assets:`);
    for (const f of results.failed) {
      console.log(`    • ${f.id}: ${f.reason}`);
    }
  }
  console.log('\nNEXT STEPS:');
  console.log('  1. Review the generated PNGs in brand/');
  console.log('  2. Derive final app icons from brand/icon-master.png:');
  console.log('     magick brand/icon-master.png -resize 192x192 public/icon-192.png');
  console.log('     magick brand/icon-master.png -resize 512x512 public/icon-512.png');
  console.log('     magick brand/icon-master.png -resize 180x180 public/apple-touch-icon.png');
  console.log('     magick brand/icon-master.png -resize 32x32 public/favicon-32.png');
  console.log('  3. Convert favicon to .ico: magick brand/icon-master.png -resize 32x32 public/favicon.ico');
  console.log('  4. Use brand/og-image.png as the default OpenGraph image in <meta> tags');
  console.log('  5. Use brand/logomark.png for social profiles and anywhere background removal is needed');
  console.log('  6. If you got 429 errors, enable billing at https://console.cloud.google.com/billing');
  console.log('─────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
