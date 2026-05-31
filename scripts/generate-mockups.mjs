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
  {
    id: 'tarjetas',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app TARJETAS (Resumen de tarjeta de crédito).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only, no other screens visible.

Light mode, background warm near-white #FAFAF9.

Layout top to bottom:
1. TOP BAR: left back-arrow icon (muted), center "Visa Santander" IBM Plex Sans 600 16px dark, right: three-dot menu icon.

2. CARD HEADER: a premium double-bezel card (~160px tall), lime-to-orange subtle gradient on the inner core (tasteful, not garish), white text. Shows:
   - Account name "Visa Santander" IBM Plex Sans 500 13px (muted white)
   - Two date columns side by side, tabular-nums, IBM Plex Mono 12px:
     Left: label "Próximo cierre" + date "15 jun" (IBM Plex Sans 400, white)
     Right: label "Vencimiento" + date "30 jun" (IBM Plex Sans 400, white)
   - Large total "$ 87.420,00" in Calistoga ~2rem white tabular-nums, centered below dates.
   - Small label above total: "Total del resumen actual" IBM Plex Sans 300 12px white muted.

3. CUOTAS QUE CAEN ESTE MES — horizontal scrollable row of chips, each chip: hairline border rounded-full, IBM Plex Sans 500 12px, dark text. Three chips visible:
   "Cuota 3/12 · $8.400 · Smart TV"
   "Cuota 1/6 · $12.300 · Notebook"
   "Cuota 7/12 · $4.200 · Heladera"
   Label above: "Cuotas que caen este mes" IBM Plex Sans 500 12px muted UPPERCASE (one of ≤1 eyebrows for this screen).

4. GASTOS DEL CICLO — section heading "Gastos del ciclo" IBM Plex Sans 600 14px dark, "ver todo" lime link right.
   List grouped by date with hairline dividers:
   - "30 may" group header (IBM Plex Sans 500 11px muted):
     • icon (shopping cart SVG) + "Supermercado Carrefour" + "− $18.300" red tabular-nums IBM Plex Mono right
     • icon (utensils SVG) + "Sushi Pop" + "− $15.800" red right
   - "28 may" group:
     • icon (gas pump SVG) + "YPF combustible" + "− $22.800" red right + small badge "Cuota 3/12" (lime hairline chip, IBM Plex Sans 400 11px)
     • icon (phone SVG) + "Netflix" + "− $4.899" red right + small badge "Recurrente" (orange hairline chip)

5. BOTTOM ACTION: full-width solid lime-green button "Registrar pago", height 52px, rounded-12, IBM Plex Sans 700 white. Sits above the bottom safe area, with a thin separator line above.

6. BOTTOM NAV: fixed, 5 items, "Cuentas" tab active (lime). Safe-area bottom padding.

Photorealistic, implementation-friendly. Light mode, premium card accent, tabular money throughout.`,
  },
  {
    id: 'cuota-nueva',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app NUEVO GASTO EN CUOTAS (bottom sheet).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only.

Background: dark #0B1410 dashboard blurred (backdrop-filter blur(6px) + rgba(0,0,0,.5) overlay), showing just enough context.

BOTTOM SHEET: light background #FAFAF9, rounded top corners radius 24px only, drag handle (short gray rounded bar) at top center. Padding 24px. Sheet covers ~85% of screen height (tall form).

Sheet content top to bottom:
1. SHEET HEADER: "Nuevo gasto en cuotas" IBM Plex Sans 600 18px dark. Close × icon right (muted dark, lime on hover).

2. DESCRIPTION INPUT: label "Descripción" IBM Plex Sans 400 13px muted above. Text input showing "Smart TV Samsung 55"" — hairline border rounded-8, IBM Plex Sans 400 16px dark. Lime focus ring.

3. TOTAL AMOUNT INPUT: label "Monto total" above. Large input "$ 156.000" in Calistoga ~2rem dark tabular-nums, centered. Lime focus ring. IBM Plex Mono.

4. INSTALLMENTS SELECTOR: label "Cantidad de cuotas" above. A 3-option segmented selector, full-width, rounded-8 container with hairline border:
   Options: "3" | "6" | "12" — "12" selected (solid lime background, white IBM Plex Sans 700). Others muted dark text. Looks like a toggle selector.
   Below selector: small helper "También podés escribir otro número" IBM Plex Sans 300 12px muted.

5. FIRST INSTALLMENT DATE: label "Fecha primera cuota" above. Date chip showing "1 de junio de 2025" (lime bg chip with calendar icon left, IBM Plex Sans 500 14px white). Tappable, full-width hairline-bordered row.

6. TWO-COLUMN ROW:
   Left: "Cuenta" select showing "Visa Santander" with credit card icon left + chevron-down right. Hairline border rounded-8.
   Right: "Categoría" select showing "Tecnología" with chevron-down. Hairline border rounded-8.

7. INSTALLMENT PREVIEW CARD: a slightly elevated card (double-bezel minimal, hairline border rounded-12), padding 16px. Shows:
   - Large "12 cuotas de $ 13.000" in IBM Plex Sans 700 18px dark, tabular-nums.
   - Below: "Total: $ 156.000" IBM Plex Sans 400 14px muted tabular.
   - Below: "Primera cuota: 1 jun 2025 · Última: 1 may 2026" IBM Plex Sans 300 12px muted.
   Small lime accent left-border on this card (2px solid lime left border as visual highlight).

8. PRIMARY CTA: full-width lime button "Guardar en cuotas" height 52px rounded-12 IBM Plex Sans 700 white. Bottom safe-area padding below.

Photorealistic, implementation-friendly. Light sheet on dark bg, tabular money, all inputs labeled above.`,
  },
  {
    id: 'cuota-detalle',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app CUOTA DETALLE (detalle de compra en cuotas).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only, no other screens visible.

Light mode, background warm near-white #FAFAF9.

Layout top to bottom:
1. TOP BAR: left back-arrow icon (muted dark), center "Detalle de cuotas" IBM Plex Sans 600 16px dark, right: trash/delete icon (destructive red #DC2626).

2. PURCHASE SUMMARY HEADER: a double-bezel premium card, outer shell warm-white, inner core slightly contrasted, hairline border, radius 16px, padding 20px. Shows:
   - Description "Smart TV Samsung 55"" IBM Plex Sans 600 17px dark. Single line.
   - Below: "Total $ 156.000" Calistoga ~1.6rem dark tabular-nums.
   - Below: progress indicator — "Cuota 3 de 12" IBM Plex Sans 500 14px, with a thin horizontal progress bar (lime fill ~25%, stone track, height 4px, rounded-full). "$ 39.000 pagados de $ 156.000" IBM Plex Sans 300 12px muted below bar.
   - Bottom row: "Visa Santander" (credit card icon + text, IBM Plex Sans 400 13px muted) left · "Tecnología" (tag icon + text, IBM Plex Sans 400 13px muted) right. Separated by a hairline divider above this row.

3. SECTION LABEL "Todas las cuotas" IBM Plex Sans 600 13px muted UPPERCASE. (One of ≤1 eyebrows.)

4. INSTALLMENTS LIST — scrollable, 12 items total visible (scroll implied), hairline dividers between rows. Each row has:
   - Left: cuota number badge "01" to "12" (IBM Plex Mono 12px, rounded-4, stone bg, muted text).
   - Center: "1 abr 2025" date IBM Plex Sans 400 14px dark (tabular-nums) + status badge right of date.
   - Right: "$ 13.000" IBM Plex Mono 14px tabular-nums.

   States:
   - Cuotas 01–02 (pagadas): status badge "Pagada" (lime bg, white IBM Plex Sans 500 11px rounded-full). Amount muted.
   - Cuota 03 (current): status badge "Este mes" (orange bg, white IBM Plex Sans 500 11px rounded-full). Amount dark bold. Row has very subtle lime-tinted left border (2px) to indicate current.
   - Cuotas 04–12 (futuras): status badge "Pendiente" (stone bg, muted text rounded-full). Amount muted stone.

   Show at least 8 cuota rows within the visible scroll area. Cuotas 01 and 02 clearly show lime "Pagada" badge.

5. DANGER ZONE — below the list, a bottom-anchored section separated by a hairline border. A text-only destructive button: trash icon + "Eliminar compra completa" IBM Plex Sans 500 14px #DC2626 red, centered. Below it: helper text "Se eliminarán las 12 cuotas asociadas." IBM Plex Sans 300 12px muted stone.

6. BOTTOM NAV: fixed, "Movimientos" tab active (lime). Safe-area bottom padding.

Photorealistic, implementation-friendly. Light mode, clean data list, clear status badges with color + text (not color alone).`,
  },

  // ─── RECURRENTES + PROGRAMADAS ───────────────────────────────────────────
  {
    id: 'recurrentes',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app RECURRENTES (lista de transacciones recurrentes).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only, no other screens visible.

Light mode, background warm near-white #FAFAF9.

Layout top to bottom:

1. TOP BAR (~56px): "Recurrentes" IBM Plex Sans 600 16px dark, centered. Left: back-arrow icon (muted). Right: search icon (muted dark).

2. PRÓXIMAS OCURRENCIAS INBOX (~120px tall): a compact horizontal-scrollable card strip labeled "Por confirmar" IBM Plex Sans 500 12px muted UPPERCASE left (this is the ONLY eyebrow on this screen). Cards (2 visible, 3rd partially): each is a small double-bezel card (outer shell hairline-bordered, inner core slightly contrasted, radius 12px, padding 12px 14px):
   Card A: category icon (calendar-clock SVG, lime) · "Alquiler" IBM Plex Sans 600 14px dark · "$ 185.000" IBM Plex Mono 500 14px tabular-nums dark · "1 jun" IBM Plex Sans 300 12px muted. Two action buttons at bottom: "Confirmar" (solid lime, micro-size, IBM Plex Sans 600 11px rounded-8) + "Saltar" (outline muted, same size).
   Card B: category icon (repeat SVG, muted stone) · "Netflix" · "$ 4.899" · "3 jun". Same action buttons.
   Card C (partially visible, ~30px showing): "Spotify" — teaser only.
   Strip has horizontal scroll implied. Background slightly off-white card strip behind the cards.

3. FILTER CHIPS: horizontal scrollable row. Active chip "Todas" (lime bg, white IBM Plex Sans 500 12px, rounded-full). Others: "Activas" · "Pausadas" · "Gastos" · "Ingresos" · "Tarjeta" (dark hairline outline, muted text, rounded-full). IBM Plex Sans 500 12px. Generous horizontal padding 12px each.

4. RECURRING TEMPLATES LIST — the main body, grouped by none (flat list with hairline dividers). At least 5 rows visible before scroll:

Row 1 — "Alquiler":
  Left: category icon circle (house SVG, lime bg #65A30D, white icon, 36px circle) · center: "Alquiler" IBM Plex Sans 600 15px dark · subtitle "Mensual · día 1" IBM Plex Sans 400 13px muted · right column: "$ 185.000" IBM Plex Mono 600 15px dark tabular-nums top-right · "Próx: 1 jun" IBM Plex Sans 300 12px muted top-right · iOS-style toggle switch ON (lime, 28px) below the amount on the right.

Row 2 — "Sueldo":
  Icon circle (arrow-up SVG, success green #16A34A bg, white icon) · "Sueldo" 600 15px · "Mensual · día 10" · "+ $ 650.000" IBM Plex Mono 600 15px SUCCESS GREEN tabular-nums · "Próx: 10 jun" · toggle ON (lime).

Row 3 — "Netflix":
  Icon circle (play SVG, orange #F97316 bg, white) · "Netflix" · "Mensual · día 3" + small badge "Tarjeta" (orange hairline chip, IBM Plex Sans 400 11px rounded-full) · "− $ 4.899" red tabular-nums · "Próx: 3 jun" · toggle ON (lime).

Row 4 — "Spotify":
  Icon circle (music-note SVG, stone bg, muted icon) · "Spotify" · "Mensual · día 15" · "− $ 2.299" muted red · "Próx: 15 jun" · toggle ON (lime).

Row 5 — "Gym":
  Icon circle (dumbbell SVG, stone bg) · "Gym" · "Mensual · día 5" · "− $ 12.000" muted red · "Próx: 5 jun" · toggle OFF (stone, switch visually off). Row has slightly muted opacity (0.6) to indicate paused.

Row 6 (partially visible): "Internet Fibertel" · "Mensual · día 20".

Hairline dividers (rgba(0,0,0,.06)) between rows. Rows have 16px horizontal padding, 14px vertical padding. IBM Plex Sans throughout. Amounts IBM Plex Mono tabular-nums. Generous vertical rhythm.

5. FAB "Nueva recurrente": floating action button, bottom-right corner, solid lime #65A30D, 56px circle, white "+" icon (24px clean SVG), warm-tinted shadow (0 8px 16px rgba(101,163,13,.3)). Positioned 24px from right edge, 80px above bottom nav.

6. BOTTOM NAV: fixed, 5 items, "Más" or generic tab active showing context. Safe-area bottom padding.

Photorealistic, implementation-friendly. Light mode. NO emoji as icons — all icons are clean SVG. Tabular numbers throughout. NO glassmorphism. Clear visual hierarchy between template name, frequency label, amount, and next-run date.`,
  },
  {
    id: 'recurrente-nueva',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app RECURRENTE NUEVA (alta de transacción recurrente).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only.

Background: dark #0B1410 dashboard blurred (backdrop-filter blur(6px) + rgba(0,0,0,.5) overlay), just enough visible to indicate context.

BOTTOM SHEET: light background #FAFAF9, rounded top corners only (radius 24px top-left/top-right), drag handle (short gray rounded bar, 36px wide × 4px tall, stone color) at top center. Padding 24px. Sheet covers ~92% of screen height (tall form, scrollable).

Sheet content top to bottom:

1. SHEET HEADER: "Nueva recurrente" IBM Plex Sans 600 18px dark left. Close × icon right (muted dark, 20px).

2. TIPO SELECTOR: 3-tab pill group, full-width, rounded-10 container, hairline border. Tabs: "Gasto" | "Ingreso" | "Transferencia". "Gasto" tab selected (solid lime bg #65A30D, white IBM Plex Sans 700 14px). Others: stone bg, muted dark text IBM Plex Sans 500 14px. Tab height 40px.

3. MONTO + MONEDA ROW: two fields side by side.
   Left (~65% width): label "Monto" IBM Plex Sans 400 13px muted above. Large input "$ 185.000" Calistoga ~2rem dark tabular-nums, lime focus ring 3px, rounded-8 hairline border. IBM Plex Mono digits.
   Right (~33% width): label "Moneda" above. Select field showing "ARS" with chevron-down, hairline border rounded-8, IBM Plex Sans 500 14px dark.

4. CUENTA SELECT: label "Cuenta" above. Full-width select showing a wallet icon left + "Cuenta corriente Santander" IBM Plex Sans 400 14px dark + chevron-down right. Hairline border rounded-8, padding 12px 14px.

5. CATEGORÍA SELECT: label "Categoría" above. Full-width select, tag icon left + "Servicios" IBM Plex Sans 400 14px dark + chevron-down right. Hairline border rounded-8.

6. FRECUENCIA SELECTOR — label "Frecuencia" IBM Plex Sans 400 13px muted above. A 5-option horizontal segmented selector, full-width, rounded-8 container with hairline border. Options: "Semanal" | "Quincenal" | "Mensual" | "Bimestral" | "Anual". "Mensual" selected (solid lime bg, white IBM Plex Sans 600 12px). Others: stone bg, muted IBM Plex Sans 400 12px. Below the selector, a contextual sub-field appears:
   Label "Día del mes" IBM Plex Sans 400 13px muted above. A number input showing "1" with − / + stepper buttons on each side (hairline-bordered, rounded-8, muted icons, IBM Plex Mono 16px dark center). Helper "El último día válido del mes si el mes es más corto." IBM Plex Sans 300 11px muted below.

7. FIN DE SEMANA ROW: label "Si cae en fin de semana" IBM Plex Sans 400 13px muted above. Three radio-chip options in a horizontal row, each a rounded-full hairline chip, IBM Plex Sans 500 12px:
   "Tal cual" (selected: lime bg, white text) · "Saltar" (stone bg, muted) · "Viernes hábil" (stone bg, muted).

8. VIGENCIA ROW: two date fields side by side.
   Left: label "Desde" above. Date chip "1 jun 2025" (lime bg, white IBM Plex Sans 500 13px, calendar icon left, rounded-8).
   Right: label "Hasta (opcional)" above. Date chip placeholder "Sin fin" (stone bg, muted IBM Plex Sans 400 13px, calendar icon left, hairline border rounded-8).

9. TARJETA TOGGLE ROW: a full-width row with a hairline divider above it, padding 14px 0. Left: "Gasto de tarjeta de crédito" IBM Plex Sans 500 14px dark + below: "Se agrupará en los resúmenes" IBM Plex Sans 300 12px muted. Right: iOS-style toggle switch OFF (stone, 28px).

10. PREVIEW CHIP: a subtle inline preview row, no border, just muted bg. Left: repeat-clock icon (lime, 16px SVG) · "Próxima ejecución: 1 de junio de 2025" IBM Plex Sans 400 13px dark. IBM Plex Mono for the date. Rounded-8, padding 10px 14px, stone-tinted background.

11. PRIMARY CTA: full-width solid lime button "Guardar recurrente" height 52px rounded-12 IBM Plex Sans 700 white. Bottom safe-area padding below.

Labels are always ABOVE inputs, never as placeholders. All inputs have visible labels. Lime focus ring on active field. Hairline borders throughout. Tabular numbers on all amounts and dates. NO nested box-in-box-in-box. NO glassmorphism.

Photorealistic, implementation-friendly. Light sheet on dark blurred bg. Clean vertical rhythm 12–16px between fields.`,
  },
  {
    id: 'programadas',
    group: 'app',
    aspect: '9:16',
    prompt: `${DESIGN_PREAMBLE}

HIGH-FIDELITY MOBILE APP SCREEN MOCKUP — mangui PWA app PROGRAMADAS (transacciones programadas + bandeja de confirmación).
Aspect ratio 9:16, mobile viewport (390px wide). One screen only, no other screens visible.

Light mode, background warm near-white #FAFAF9.

Layout top to bottom:

1. TOP BAR (~56px): "Programadas" IBM Plex Sans 600 16px dark centered. Left: back-arrow icon (muted). Right: "+" icon (lime, 20px) to add a new scheduled transaction.

2. BANDEJA DE CONFIRMACIÓN SECTION — label "Acción requerida" IBM Plex Sans 500 12px muted UPPERCASE left (the ONLY eyebrow on this screen). A vertically-stacked inbox of 2–3 items requiring user action (mix of pending recurring occurrences and scheduled transactions that arrived):

Item A (recurring occurrence): left side has a lime left-border accent (2px solid #65A30D) on the card. Row: repeat icon (lime, 16px SVG) · "Alquiler · Recurrente" IBM Plex Sans 600 14px dark · subtitle "Vence 1 jun 2025" IBM Plex Sans 300 12px muted. Right: "$ 185.000" IBM Plex Mono 600 14px dark tabular-nums. Below text, inline 3 action buttons (micro, compact, 28px tall): "Confirmar" (solid lime, IBM Plex Sans 600 11px rounded-6, white text) · "Editar" (outline muted dark, same size) · "Saltar" (text-only, destructive stone, IBM Plex Sans 400 11px). Hairline border around full item card, radius 10px, padding 12px 14px, warm-white bg, subtle tinted shadow.

Item B (scheduled one-time): left border accent orange #F97316 (2px). Row: calendar icon (orange, 16px SVG) · "Pago seguro hogar · Programada" IBM Plex Sans 600 14px dark · "Vence 5 jun 2025" IBM Plex Sans 300 12px muted. Right: "$ 28.400" IBM Plex Mono 600 14px dark tabular. Buttons: "Confirmar" · "Editar" · "Rechazar" (same micro-button pattern, "Rechazar" in #DC2626 red text-only).

Hairline divider between items in the inbox section.

3. FILTER CHIPS: horizontal scrollable row. "Todas" active (lime bg, white rounded-full IBM Plex Sans 500 12px). Others: "Pendientes" · "Ejecutadas" · "Rechazadas" · "Ingresos" · "Gastos" · "Transferencias". Stone hairline chips, muted text, rounded-full 12px.

4. SCHEDULED TRANSACTIONS LIST — flat list, hairline dividers, at least 5 rows visible before scroll. Each row: 16px horizontal padding, 14px vertical padding.

Row 1 — "Renovación seguro auto" (pending):
  Left: calendar icon circle (34px, stone bg, calendar SVG muted) · "Renovación seguro auto" IBM Plex Sans 600 14px dark · "10 jun 2025 · Gasto" IBM Plex Sans 300 12px muted. Right: "− $ 62.000" IBM Plex Mono 500 14px red tabular · status badge "Pendiente" (stone bg, muted IBM Plex Sans 500 11px rounded-full).

Row 2 — "Cobro freelance" (pending, income):
  Icon circle (arrow-up SVG, success green bg) · "Cobro freelance diseño" · "15 jun 2025 · Ingreso" · "+ $ 120.000" IBM Plex Mono 500 14px SUCCESS GREEN · badge "Pendiente".

Row 3 — "Netflix" (executed):
  Icon circle (play SVG, stone bg, muted icon) · "Netflix" · "3 jun 2025 · Gasto" · "− $ 4.899" muted IBM Plex Mono · badge "Ejecutada" (lime bg #65A30D, white IBM Plex Sans 500 11px rounded-full). Row muted opacity ~0.7.

Row 4 — "Transferencia ahorro USD" (pending, transfer):
  Icon circle (arrows-exchange SVG, stone bg) · "Transferencia ahorro USD" · "20 jun 2025 · Transferencia" · "$ 50.000" muted IBM Plex Mono · badge "Pendiente".

Row 5 — "Pago tarjeta Visa" (rejected):
  Icon circle (credit-card SVG, stone bg) · "Pago tarjeta Visa" · "28 may 2025 · Gasto" · "− $ 87.420" muted red · badge "Rechazada" (#DC2626 bg, white IBM Plex Sans 500 11px rounded-full). Row muted opacity ~0.6.

Row 6 (partially visible, ~half row): "Internet + teléfono" · "25 jun".

Hairline dividers between rows. Amount column uses IBM Plex Mono tabular-nums throughout. Status badges always show color + text (never color alone). Income amounts are GREEN, expense amounts are RED, transfers NEUTRAL muted.

5. FAB "Nueva programada": floating action button, bottom-right, lime #65A30D, 56px circle, white "+" icon (24px SVG), warm-tinted lime shadow. 24px from right, 80px above bottom nav.

6. BOTTOM NAV: fixed, 5 items, appropriate tab active. Safe-area bottom padding.

Photorealistic, implementation-friendly. Light mode. NO emoji as icons — clean SVG vector icons. Tabular numbers on ALL amounts and dates. Clear status badge differentiation: Pendiente (stone) / Ejecutada (lime) / Rechazada (red). Inbox items visually distinct from the main list via the colored left-border accent and shadow.`,
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
