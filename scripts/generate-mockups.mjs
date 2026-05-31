#!/usr/bin/env node
/**
 * generate-mockups.mjs
 *
 * Generates per-section high-fidelity design mockup images for mangui
 * using Google's Gemini image generation model (gemini-2.5-flash-image).
 *
 * Usage:
 *   node scripts/generate-mockups.mjs [--group landing|app] [--only hero,pricing] [--out design-mockups]
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
    group: null,   // 'landing' | 'app' | null (all)
    only: null,    // Set<string> | null (all)
    out: 'design-mockups',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--group' && args[i + 1]) {
      opts.group = args[++i];
    } else if (args[i] === '--only' && args[i + 1]) {
      opts.only = new Set(args[++i].split(',').map(s => s.trim()));
    } else if (args[i] === '--out' && args[i + 1]) {
      opts.out = args[++i];
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Shared design system preamble baked into every prompt
// ---------------------------------------------------------------------------
const DESIGN_PREAMBLE = `
Design system context for mangui (apply strictly):
- Brand: playful-premium mango fintech app for Argentina. Mango mascot (lime + orange). NOT generic fintech.
- Palette: primary lime-green #65A30D (light) / #84CC16 (dark highlights); accent orange #F97316; success #16A34A; destructive #DC2626; background warm near-white #FAFAF9 (light) / deep teal-charcoal #0B1410 (dark); foreground #1C1917 / #F5F5F4; hairline borders rgba(0,0,0,.06).
- ONE tasteful brand gradient: lime #65A30D → orange #F97316, used sparingly only on hero accent or primary CTA. NO AI purple/blue gradients. NO gradient text.
- Typography: IBM Plex Sans for body/UI (weights 300–700); Calistoga display font for hero headings and big balance numbers (warm, rounded, friendly). ALL monetary amounts, rates, and dates use tabular-nums (monospaced digit alignment).
- Layout: asymmetric, varied compositions — NO centered-everything hero, NO 3-equal-column feature grids. Hero clean ≤3 lines of text. Generous section padding (min 96px vertical desktop). Hairline borders only (1px). NO nested box-in-box-in-box.
- Language: Spanish (es-AR). Copy is real, NOT Lorem Ipsum, NOT placeholder names. Use realistic Argentine peso (ARS) and dollar (USD) amounts with $ and USD signs.
- Components: double-bezel premium cards (outer shell + inner core), data lists use dividers not bezel. Subtle warm-tinted shadows. Radius 8–12px buttons/cards, 16px large cards, never >16px on cards.
- Anti-slop: NO AI purple/blue glow, NO cards-in-cards, NO centered-everything, NO eyebrow on every section, NO 01/02/03 numbered markers, NO glassmorphism default, NO ghost cards, NO emoji as icons (use clean vector icons), NO Lorem Ipsum, NO "Seamless/Elevate/Unleash" AI clichés, NO fake precision stats, NO system font.
`.trim();

// ---------------------------------------------------------------------------
// SECTIONS definition
// ---------------------------------------------------------------------------
const SECTIONS = [
  // ═══════════════════════════════════════════════════════════════════════
  // LANDING — 16:9 desktop web sections
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'hero',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page HERO.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only, no other sections visible.

Composition: asymmetric split layout. Left ~55%: headline in Calistoga display font, EXACTLY 3 lines maximum:
  Line 1 (large, ~3.5rem): "Controlá tu plata"
  Line 2 (large): "en pesos y dólares."
  Line 3 (smaller subheadline, IBM Plex Sans 400, ~1.125rem, muted stone color, 55ch max): "La app de finanzas personales para argentinos que quieren entender cada peso."
Below that: two buttons — primary solid lime-green "Crear cuenta gratis" + secondary outline "Ver demo". Tagline above headline: small lime-green ALL-CAPS badge "BETA GRATUITA" (the ONLY eyebrow on this section, kept tiny).
Right ~45%: a clean device frame (laptop or phone+laptop) showing the mangui dashboard UI inside — mango accent visible, dark teal sidebar, balance in Calistoga, mini chart. Subtle lime→orange gradient accent blob partially behind the device frame (tasteful, not garish).

Background: warm near-white #FAFAF9. Top nav: single line ~72px tall, logo left (mango icon + "mangui" wordmark in Calistoga), nav links center (Funciones / Precios / Para quién), "Ingresar" ghost button + "Crear cuenta" lime CTA right.

Photorealistic, implementation-friendly UI design reference. Readable text. No stock photos of people.`,
  },
  {
    id: 'trust-bar',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page TRUST BAR.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only (short horizontal strip), no other sections visible.

A slim horizontal trust/social-proof strip, background slightly lighter card tone over #FAFAF9, 1px hairline border top and bottom (rgba(0,0,0,.06)). Content centered horizontally in a container, items arranged in a single horizontal row with generous spacing:

Left cluster: "Más de 2.400 usuarios activos" in IBM Plex Sans 600 + small star row (4.8 stars, lime filled stars).
Middle cluster: security badge "Datos 100% locales" with a small shield SVG icon (no emoji).
Right cluster: "PWA — instalable sin App Store" with a download/install icon.
Dividers (1px hairline rgba(0,0,0,.06)) between clusters.

All text IBM Plex Sans. Numbers tabular-nums. NO background gradient. NO glassmorphism. Section height approx 80px. Warm near-white.

Photorealistic, implementation-friendly UI design reference. Clean, minimal.`,
  },
  {
    id: 'features-bento',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page FEATURES BENTO GRID.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only, no other sections visible.

Section heading (IBM Plex Sans 700, ~2.25rem, left-aligned, NOT centered): "Todo lo que necesitás para manejar tu plata." No eyebrow label.

Below: asymmetric bento grid, grid-auto-flow dense, ZERO empty cells, 6 cards total covering these features:
1. "Multimoneda ARS y USD" — large card (~2 cols wide): shows a clean UI snippet of a balance toggle ARS ↔ USD with tabular numbers, lime accent. IBM Plex Mono for amounts.
2. "Tarjetas y cuotas" — medium card: shows a mini card-installment breakdown list, date + amount columns with tabular-nums.
3. "Gastos recurrentes y reglas" — medium card: icon + brief description, small list of recurring items (Netflix, Spotify, alquiler) with amounts in ARS.
4. "Presupuestos y metas" — medium card: small horizontal progress bar in lime-green, "Supermercado: $38.200 / $50.000".
5. "Carga rápida" — small card: a simplified add-movement button/sheet preview, orange accent.
6. "Funciona offline (PWA)" — small card: offline icon + "Instalá sin App Store" copy.

Cards: double-bezel premium style (outer warm-white shell, inner slightly contrasted core, hairline borders, radius 12–16px, warm-tinted shadows). NO shadow-xl on small cards.

Background: warm near-white #FAFAF9. Photorealistic, implementation-friendly UI design reference.`,
  },
  {
    id: 'product-showcase',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page PRODUCT SHOWCASE.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only, no other sections visible.

Layout: full-width section, dark background (#0B1410 deep teal-charcoal). Left 40%: editorial copy block vertically centered. IBM Plex Sans 700 ~2rem heading (white text): "El dashboard que realmente querías." Subtext IBM Plex Sans 400 18px muted (#F5F5F4 at 70% opacity): "Balances, movimientos, gráficos. Todo en un vistazo, sin ruido." Below: lime CTA button "Probarlo gratis".

Right 60%: a large laptop frame (dark bezel) with the mangui dashboard UI rendered inside at high detail:
  - Dark teal sidebar left with nav items (Inicio, Movimientos, Cuentas, Stats, Más) and mango logo top.
  - Main area: balance hero "$ 487.320" in Calistoga display (white), small "USD 312" tabular below, lime accent toggle.
  - Below balance: horizontal strip showing USD Blue / MEP / CCL exchange rates (tabular-nums, monospaced).
  - Donut chart (lime primary + orange secondary) labeled "Gastos por categoría" with legend.
  - Mini bar chart "Ingresos vs Gastos" last 3 months in lime/red-orange.
  - Recent activity list: 3–4 items with date, merchant name, amount (+ green / − red), tabular-nums.
  Laptop frame casts a subtle warm shadow. A lime→orange gradient glow very subtly behind the laptop (tasteful).

Photorealistic, implementation-friendly UI design reference. Dark section, readable text on dark.`,
  },
  {
    id: 'argentina-differentiators',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page ARGENTINA DIFFERENTIATORS.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only, no other sections visible.

Section is specifically about features unique to the Argentine financial context. Left-aligned section heading (IBM Plex Sans 700, ~2rem): "Hecha para la realidad argentina." No eyebrow.

Layout: 2-column zig-zag (NOT 3-equal-columns). First row: left text block + right UI snippet. Second row: right text block + left UI snippet (alternated). Third row spans full or 2-col.

Features to cover:
1. "Multidólar: Blue, MEP y CCL" — text left: explains tracking multiple exchange rates. Right: a clean rate-display UI card showing "USD Blue $1.285,50 | MEP $1.271,20 | CCL $1.290,00" in tabular-nums, IBM Plex Mono for numbers, hairline-bordered table rows.
2. "Ciclo de resumen de tarjeta" — text right: explains credit card billing cycle tracking. Left: a mini calendar/timeline UI showing cierre "15 del mes" and vencimiento "30 del mes" with installment items below.
3. "Cuotas sin recargo inteligentes" — full-width or wide card: shows an installment breakdown UI, e.g. "Cuota 3/12 — $8.400 — Visa Santander" with a subtle progress indicator.
4. "Inflación en contexto" — a small card or row: shows balance "hace 6 meses: $ 320.000 → hoy $ 487.320 (+52% inflación ~101%)" with a small sparkline or comparison.

Background: warm near-white #FAFAF9. Photorealistic, implementation-friendly UI. Real Argentine peso amounts in tabular-nums.`,
  },
  {
    id: 'testimonials',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page TESTIMONIALS.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only, no other sections visible.

Section heading (IBM Plex Sans 700, ~2rem, left-aligned): "Lo que dicen quienes ya la usan." NO eyebrow.

Layout: horizontal row of 3 testimonial cards (NOT 3-equal identical — vary card height slightly via quote length). Each card: double-bezel premium style, warm-white outer shell, inner core slightly contrasted, hairline border, radius 16px, warm-tinted shadow.

Card content:
  - Quote text IBM Plex Sans 400, 16px, real quote (NOT Lorem Ipsum, NOT generic praise):
    Card 1: "Nunca entendí bien lo del MEP hasta que mangui me lo mostró en contexto con mis gastos. Ahora sé exactamente cuándo conviene cambiar."
    Card 2: "Las cuotas me estaban comiendo el saldo sin que me diera cuenta. Con mangui veo todo de un vistazo y pude organizarme mucho mejor."
    Card 3: "La carga de gastos es super rápida y el resumen mensual me ayudó a bajar $15.000 en gastos innecesarios en el primer mes."
  - Below quote: small avatar placeholder (a colored circle monogram — NOT a stock photo), name "Sofía R." / "Matías G." / "Luciana P.", role/location "CABA · Freelancer" (small, muted). 5 lime stars.

Background: warm near-white #FAFAF9. Photorealistic, implementation-friendly UI design reference.`,
  },
  {
    id: 'pricing',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page PRICING.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only, no other sections visible.

Section heading (IBM Plex Sans 700, ~2rem, centered — ONLY this section uses centered heading because pricing cards demand symmetry): "Planes simples, sin sorpresas." Subtext centered, muted, 18px: "Gratis para siempre en lo esencial. Pro para quienes quieren más."

Layout: 2 pricing cards side by side, centered with generous padding (NOT 3 cards). Cards asymmetric in visual weight:

FREE card (left): slightly smaller visual weight. White background, hairline border. Label "Free" in IBM Plex Sans 600. Price "$ 0 / mes" in Calistoga ~2.5rem, tabular-nums. Feature list with check icons (lime):
  - Hasta 3 cuentas
  - Movimientos ilimitados
  - Multimoneda ARS y USD
  - Cotizaciones del día
  - App PWA instalable

PRO card (right): visually prominent. Lime gradient background (#65A30D → #84CC16 subtle), white text, deeper shadow. Label "Pro" + small orange badge "MÁS POPULAR". Price "$ 2.900 / mes" in Calistoga ~2.5rem, tabular-nums. Feature list (white check icons):
  - Todo lo de Free
  - Cuentas ilimitadas
  - Ciclo de resumen y cuotas
  - Presupuestos y metas
  - Reglas y recurrentes
  - Exportar a CSV
  - Soporte prioritario
CTA inside PRO card: white button "Empezar gratis 30 días".

FREE card CTA: outline lime button "Crear cuenta gratis".

Background: warm near-white #FAFAF9. Photorealistic, implementation-friendly UI design reference.`,
  },
  {
    id: 'final-cta-footer',
    group: 'landing',
    aspect: '16:9',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY WEBSITE SECTION MOCKUP — mangui landing page FINAL CTA + FOOTER.
Aspect ratio 16:9, desktop viewport (1440px wide). One section only (CTA band + footer below), no other sections visible.

UPPER BAND (CTA): full-width, dark background #0B1410 (deep teal-charcoal). Content centered but NOT centered-everything — slightly left-weighted text. Heading Calistoga ~2.5rem white: "¿Listo para tomar el control?" Subtext IBM Plex Sans 400 18px, muted (#F5F5F4 at 70%): "Empezá gratis. Sin tarjeta. Sin compromiso." Two buttons: primary solid lime "Crear cuenta gratis" + ghost white outline "Ver demo". Tasteful lime→orange gradient accent shape in background (far right corner, subtle blob, NOT a banner). Small mango mascot illustration suggestion (lime/orange simplified icon, NOT emoji, NOT stock).

FOOTER (below CTA band): warm near-white #FAFAF9 background. 4-column footer grid:
  Col 1: mangui logo + tagline "Finanzas personales para Argentina." + social icons (Twitter/X, Instagram, GitHub placeholders as clean SVG squares).
  Col 2: "Producto" — links: Funciones, Precios, Changelog, Estado del servicio.
  Col 3: "Soporte" — links: Centro de ayuda, Privacidad, Términos.
  Col 4: "Desarrollado con ♥ en Argentina" + "© 2025 mangui" + "Datos almacenados localmente en tu dispositivo."

Footer links IBM Plex Sans 400 14px muted. Hairline top border. Reasonable padding.

Photorealistic, implementation-friendly UI design reference.`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // APP — 9:16 mobile screens
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'dashboard',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app DASHBOARD (Inicio).
Aspect ratio 9:16, mobile viewport (390px wide, iPhone-class). One screen only, no other screens visible.

This is the main home screen of the mangui PWA (progressive web app). Dark mode, background #0B1410 deep teal-charcoal.

Layout top to bottom:
1. TOP BAR (~64px): left "mangui" wordmark (Calistoga, white), right: notification bell icon + avatar circle (monogram, lime border).

2. BALANCE HERO: large centered section. Small label "Saldo total" IBM Plex Sans 300 muted. Big balance in Calistoga ~3rem white "$ 487.320,15" with tabular-nums. Below: smaller "USD 312,00" in IBM Plex Mono tabular, muted. Toggle pill switcher "ARS | USD" in lime-green (tappable, lime selected state).

3. EXCHANGE RATE STRIP: horizontal scrollable strip, 3 rate chips: "USD Blue $1.285,50" / "MEP $1.271,20" / "CCL $1.290,00". IBM Plex Mono, small (12px), tabular-nums, hairline border, subtle dark card background slightly lighter than #0B1410. NO EMOJI.

4. DONUT CHART "Gastos por categoría": ~180px tall donut chart, lime primary segment largest (Supermercado 38%), orange secondary (Transporte 22%), muted gray rest. Center label "Mayo" + "$124.800" total. Legend below in 2-col grid, small colored dots + label + amount tabular-nums. Chart slightly off-center left (asymmetric) with legend right.

5. BAR CHART "Ingresos vs Gastos": 3-bar-group chart for Mar/Abr/May. Income bars lime-green, expense bars red-orange. Y-axis minimal gridlines. Labels tabular-nums compact ($485k / $124k style).

6. RECENT ACTIVITY header "Actividad reciente" + "Ver todo" link (lime). 3–4 list items: icon (category SVG) + merchant name + date right + amount right (+ green / − red, tabular-nums). Hairline dividers between items. IBM Plex Sans.

7. BOTTOM NAV: fixed, dark with backdrop-filter blur, 5 items: Inicio (lime, active) / Movimientos / Cuentas / Stats / Más. Icon + label IBM Plex Sans 400 10px. Safe-area bottom padding.

Photorealistic, implementation-friendly. Dark UI, lime/orange accents, tabular numbers throughout.`,
  },
  {
    id: 'activity-feed',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app ACTIVITY FEED (Movimientos).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only, no other screens visible.

Dark mode, background #0B1410 deep teal-charcoal.

Layout top to bottom:
1. TOP BAR: "Movimientos" title center (IBM Plex Sans 600 white), filter icon right, search icon.

2. FILTER CHIPS: horizontal scrollable row of filter chips below top bar. Active chip "Todos" (lime background, white text). Other chips: "Gastos" / "Ingresos" / "Transferencias" / "Cuotas" (dark outline chips). IBM Plex Sans 500 12px.

3. DATE GROUPS + TRANSACTIONS — the main body, grouped by date:

Group header "Hoy — 31 de mayo" (IBM Plex Sans 500 12px UPPERCASE, muted stone, left-padded).
  - Transaction: icon (shopping cart SVG) + "Supermercado Día" + "Supermercados · Efectivo" subtitle muted · amount "− $8.420" RED RIGHT (tabular-nums, IBM Plex Mono).
  - Transaction: icon (fork SVG) + "Sushi Pop" + "Restaurantes · Visa" · "− $15.300" RED RIGHT.

Group header "Ayer — 30 de mayo":
  - Transaction: up-arrow icon + "Sueldo mayo" + "Ingresos · Cuenta corriente" · "+ $350.000" GREEN RIGHT bold.
  - Transaction: arrows icon + "Transferencia a ahorro" + "Transferencia · entre cuentas" · "− $50.000" NEUTRAL (muted, tabular).

Group header "28 de mayo":
  - Transaction: car icon + "YPF combustible" + "Transporte" · "− $22.800".
  - Transaction: phone icon + "Mercado Pago" + "Servicios" · "− $3.200".
  - Transaction: star/sub icon + "Netflix" + "Suscripciones" · "− $4.899" + small badge "Recurrente".

Hairline dividers between items within a group. IBM Plex Sans body, IBM Plex Mono amounts. Group headers have slightly more top padding.

4. BOTTOM NAV: same as dashboard, "Movimientos" tab active (lime).

Photorealistic, implementation-friendly. Dark UI.`,
  },
  {
    id: 'accounts-list',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app ACCOUNTS LIST (Cuentas).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only, no other screens visible.

Dark mode, background #0B1410 deep teal-charcoal.

Layout top to bottom:
1. TOP BAR: "Cuentas" title (IBM Plex Sans 600 white center), "+" add icon right (lime colored).

2. TOTAL BALANCE SUMMARY: a prominent summary card, slightly lighter background than #0B1410 (double-bezel premium), hairline border rgba(255,255,255,.08). Shows:
   - Label "Patrimonio total" IBM Plex Sans 300 muted
   - "$ 1.287.450,00" Calistoga ~2.2rem white tabular-nums
   - Row below: "ARS $ 975.450 · USD $ 312,00" IBM Plex Mono 14px muted tabular

3. SECTION HEADER "Mis cuentas" IBM Plex Sans 600 14px muted uppercase.

4. ACCOUNT CARDS list (4 accounts), each card: rounded 12px, slightly lighter than bg, hairline border. Content:
   a. "Cuenta corriente Santander" — bank icon (clean SVG, NOT emoji) + bank color accent dot lime · balance "$ 487.320,15" Calistoga bold white tabular · subtitle "ARS · Débito" muted
   b. "Efectivo en pesos" — wallet icon · "$ 38.130,00" · "ARS · Efectivo"
   c. "Visa Santander" — credit-card icon · "$ −42.300" RED (debt) · "ARS · Crédito · Cuotas: 4 activas" · small progress bar showing ciclo progress (hairline)
   d. "Cuenta dólares" — globe/$ icon · "USD 312,00" tabular · "USD · Ahorro"
   Each card has a right chevron icon. IBM Plex Sans throughout. Generous padding 16–20px.

5. Section "Agregar cuenta" — a dashed-border card placeholder (hairline dashed, 8px radius) with "+" icon + "Agregar cuenta" text (lime). Single row.

6. BOTTOM NAV: "Cuentas" tab active.

Photorealistic, implementation-friendly. Dark UI, clean data hierarchy.`,
  },
  {
    id: 'add-movement-sheet',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app ADD MOVEMENT BOTTOM SHEET.
Aspect ratio 9:16, mobile viewport (390px wide). One screen only.

This shows the dashboard screen partially visible in the background (dark, blurred), with the ADD MOVEMENT bottom sheet dragged up from the bottom, covering ~75% of screen height.

BACKGROUND (partially visible, blurred): dark #0B1410 dashboard blurred with backdrop-filter blur(6px) + rgba(0,0,0,.5) overlay. Shows just enough of the dashboard to indicate context.

BOTTOM SHEET: white/light background (#FAFAF9) with rounded top corners (radius 24px top-left/top-right only). Has a small drag handle (short gray rounded bar) at top center. Padding 24px.

Sheet content top to bottom:
1. SHEET HEADER: "Nuevo movimiento" IBM Plex Sans 600 18px dark. Close (×) icon right, lime colored.

2. TYPE SELECTOR: 3-tab pill group, full-width. Tabs: "Gasto" | "Ingreso" | "Transferencia". "Gasto" selected (solid lime bg, white text). Others: muted outline. IBM Plex Sans 600 14px.

3. AMOUNT INPUT: large centered amount field. Label "Monto" IBM Plex Sans 400 14px muted above. Large input showing "$ 15.300" in Calistoga ~2.5rem dark, tabular-nums, cursor blinking. Below: helper text muted "Escribí el monto en pesos" IBM Plex Sans 300 12px. Lime focus ring around input.

4. FIELDS ROW 1: two side-by-side select fields:
   Left: "Cuenta" select — shows "Visa Santander" with a chevron-down, hairline border rounded-8.
   Right: "Categoría" select — shows "Restaurantes" with a chevron-down.

5. DESCRIPTION INPUT: text input "Descripción (opcional)" with placeholder "Ej: Sushi Pop" — hairline border, rounded-8, IBM Plex Sans.

6. DATE ROW: "Fecha" label + date chip "31 de mayo" (lime-bg chip) + calendar icon. IBM Plex Sans.

7. PRIMARY CTA BUTTON: full-width, solid lime-green (#65A30D), white text IBM Plex Sans 700 "Guardar gasto", height 52px, rounded-12. Visible lime focus ring. Above it: a subtle thin safety-area-aware spacer.

Safe-area bottom padding respected. IBM Plex Mono for amount. All inputs have labels above (not placeholder-as-label). Readable.

Photorealistic, implementation-friendly. Light sheet on dark background, high-contrast.`,
  },
];

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const INTER_REQUEST_DELAY_MS = 4000; // 4s between requests to respect rate limits

async function generateImage(apiKey, prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
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

  // Filter sections
  let sections = SECTIONS;
  if (opts.group) {
    sections = sections.filter(s => s.group === opts.group);
    if (sections.length === 0) {
      console.error(`ERROR: No sections found for group "${opts.group}". Valid groups: landing, app`);
      process.exit(1);
    }
  }
  if (opts.only) {
    sections = sections.filter(s => opts.only.has(s.id));
    if (sections.length === 0) {
      console.error(`ERROR: No sections matched --only filter. Available ids: ${SECTIONS.map(s => s.id).join(', ')}`);
      process.exit(1);
    }
  }

  // Ensure output directory exists
  const outDir = path.resolve(PROJECT_ROOT, opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\nmangui mockup generator`);
  console.log(`  Output dir : ${outDir}`);
  console.log(`  Sections   : ${sections.length} (of ${SECTIONS.length} total)`);
  console.log(`  Endpoint   : ${GEMINI_ENDPOINT}\n`);

  const results = { succeeded: [], failed: [] };

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const label = `[${i + 1}/${sections.length}] ${section.group}__${section.id}`;

    process.stdout.write(`${label} … `);

    try {
      const response = await generateImage(apiKey, section.prompt);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 'unknown';
        console.log(`429 quota/billing — skipping. (retry-after: ${retryAfter}s)`);
        console.log(
          `  HINT: 429 means billing is not enabled or quota is exhausted.\n` +
            `  Enable billing at https://console.cloud.google.com/billing and try again.`
        );
        results.failed.push({ id: section.id, reason: '429 quota/billing' });
        if (i < sections.length - 1) await sleep(INTER_REQUEST_DELAY_MS);
        continue;
      }

      if (!response.ok) {
        const bodyText = await response.text();
        console.log(`HTTP ${response.status} error`);
        console.error(`  Body (first 200 chars): ${bodyText.slice(0, 200)}`);
        results.failed.push({ id: section.id, reason: `HTTP ${response.status}` });
        if (i < sections.length - 1) await sleep(INTER_REQUEST_DELAY_MS);
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
        results.failed.push({ id: section.id, reason: 'no inlineData in response' });
        if (i < sections.length - 1) await sleep(INTER_REQUEST_DELAY_MS);
        continue;
      }

      // Decode base64 and write PNG
      const imageBuffer = Buffer.from(imageData, 'base64');
      const ext = mimeType.includes('png') ? 'png' : mimeType.split('/')[1] || 'png';
      const filename = `${section.group}__${section.id}.${ext}`;
      const outPath = path.join(outDir, filename);

      fs.writeFileSync(outPath, imageBuffer);
      const sizeStr = formatBytes(imageBuffer.length);
      console.log(`saved ${sizeStr} → ${filename}`);
      results.succeeded.push({ id: section.id, filename, size: imageBuffer.length });

    } catch (err) {
      console.log(`error — ${err.message}`);
      results.failed.push({ id: section.id, reason: err.message });
    }

    // Delay between requests (skip after last one)
    if (i < sections.length - 1) {
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  // Summary
  console.log('\n─────────────────────────────────────');
  console.log(`  DONE  ${results.succeeded.length} succeeded · ${results.failed.length} failed`);
  if (results.succeeded.length > 0) {
    console.log(`  Saved to: ${outDir}/`);
  }
  if (results.failed.length > 0) {
    console.log(`  Failed sections:`);
    for (const f of results.failed) {
      console.log(`    • ${f.id}: ${f.reason}`);
    }
  }
  console.log('\nNEXT STEPS:');
  console.log('  1. Review the generated PNGs in design-mockups/');
  console.log('  2. For each section, use the mockup to drive image→code redesign:');
  console.log('     - Pass the PNG to an image-to-code agent with the matching component file');
  console.log('     - Reference design-system/mangui/DESIGN.md for token/style constraints');
  console.log('  3. If you got 429 errors, enable billing at https://console.cloud.google.com/billing');
  console.log('─────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
