# scripts/

## generate-mockups.mjs

Generates per-section high-fidelity design mockup images for mangui using
Google's Gemini image generation model (`gemini-2.5-flash-image`).

### Requirements

- Node.js 18+ (uses native `fetch` and ESM)
- A Gemini API key with **billing enabled** — free-tier accounts return 429.
  Enable billing at https://console.cloud.google.com/billing

### Setup

Add your key to `.env.local` in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Or export it directly before running:

```bash
export GEMINI_API_KEY=your_key_here
```

### Usage

```bash
# Generate all 12 sections
node scripts/generate-mockups.mjs

# Only landing sections
node scripts/generate-mockups.mjs --group landing

# Only app screens
node scripts/generate-mockups.mjs --group app

# Only specific sections by id
node scripts/generate-mockups.mjs --only hero,pricing

# Custom output directory
node scripts/generate-mockups.mjs --out /tmp/my-mockups

# Combine filters
node scripts/generate-mockups.mjs --group landing --only hero,features-bento,pricing
```

### Output

Images are saved to `design-mockups/` (default):

```
design-mockups/
  landing__hero.png
  landing__trust-bar.png
  landing__features-bento.png
  landing__product-showcase.png
  landing__argentina-differentiators.png
  landing__testimonials.png
  landing__pricing.png
  landing__final-cta-footer.png
  app__dashboard.png
  app__activity-feed.png
  app__accounts-list.png
  app__add-movement-sheet.png
```

The `design-mockups/` folder is `.gitignore`d (only the `.gitkeep` is tracked).

### Section list

| id | group | aspect | description |
|----|-------|--------|-------------|
| `hero` | landing | 16:9 | Asymmetric hero with value prop and device mockup |
| `trust-bar` | landing | 16:9 | Social proof strip (users, security, PWA) |
| `features-bento` | landing | 16:9 | Asymmetric bento grid of 6 key features |
| `product-showcase` | landing | 16:9 | Dashboard inside laptop frame, dark bg |
| `argentina-differentiators` | landing | 16:9 | Multidólar, ciclo, cuotas, inflación |
| `testimonials` | landing | 16:9 | 3 real user testimonials with Argentine context |
| `pricing` | landing | 16:9 | Free / Pro plans, clear pricing |
| `final-cta-footer` | landing | 16:9 | Dark CTA band + 4-col footer |
| `dashboard` | app | 9:16 | Home screen: balance, rates, donut, bars, activity |
| `activity-feed` | app | 9:16 | Movimientos grouped by date, ARS/USD amounts |
| `accounts-list` | app | 9:16 | All accounts with balances, credit card progress |
| `add-movement-sheet` | app | 9:16 | Bottom sheet: type/amount/account/category/save |

### Error codes

- **429** — Quota exceeded or billing not enabled. The script logs a clear message and continues to the next section (does not crash).
- **Other non-200** — Logs the HTTP status and first 200 characters of the body, then continues.

### Next steps after generation

1. Review the PNGs in `design-mockups/`.
2. For each section, pass the PNG + the matching component file to an image-to-code agent.
3. Reference `design-system/mangui/DESIGN.md` for token and style constraints.

---

## generate-branding.mjs

Redesigns the mangui logo and generates all brand assets using the same
`gemini-2.5-flash-image` model. The existing `logo.png` (repo root) is passed
as an **input reference image** so the model redesigns in the same spirit:
a cheerful mango wearing dark sunglasses + money cue (dollar bill / coin),
cleaned up into premium flat vector-style art.

### Requirements

Same as `generate-mockups.mjs`: Node.js 18+, `GEMINI_API_KEY` with billing enabled.

### Usage

```bash
# Generate all 7 brand assets (with logo.png as reference)
node scripts/generate-branding.mjs

# Only specific assets
node scripts/generate-branding.mjs --only icon-master,og-image

# Skip the reference image — pure prompt, fresh take
node scripts/generate-branding.mjs --no-ref

# Custom output directory (default: brand/)
node scripts/generate-branding.mjs --out /tmp/brand-test

# Combine flags
node scripts/generate-branding.mjs --only logomark,mascot --no-ref
```

### Output

Images are saved to `brand/` (default). These are committed as brand assets
(not gitignored — unlike design-mockups/).

```
brand/
  icon-master.png          # App icon (iOS-style, gradient bg, mango + money)
  logomark.png             # Character only on plain white (background-removal ready)
  logo-horizontal-light.png  # Horizontal lockup on warm near-white #FAFAF9
  logo-horizontal-dark.png   # Horizontal lockup on deep teal-charcoal #0B1410
  wordmark.png             # Just "mangui" typographic logotype (no character)
  og-image.png             # 1200×630 OpenGraph / social share card
  mascot.png               # Full-body character for empty-states / illustrations
```

### Asset list

| id | useRef | description |
|----|--------|-------------|
| `icon-master` | yes | 1024×1024-scale app icon, gradient bg, mango + sunglasses + dollar bill |
| `logomark` | yes | Mango character isolated on plain white, for background removal |
| `logo-horizontal-light` | yes | Logomark + "mangui" wordmark on light (#FAFAF9) background |
| `logo-horizontal-dark` | yes | Logomark + "mangui" wordmark on dark (#0B1410) background |
| `wordmark` | no | Typographic "mangui" only — lime letters, orange "i" accent |
| `og-image` | yes | 1200×630 landscape social/OG card with character + headline copy |
| `mascot` | yes | Full-body mascot on plain white, for onboarding / empty-states |

### Deriving app icons from icon-master.png

After reviewing `brand/icon-master.png`, generate the final production icons
with ImageMagick (`magick` / `convert`) or `sharp`:

```bash
# PWA manifest icons
magick brand/icon-master.png -resize 192x192 public/icon-192.png
magick brand/icon-master.png -resize 512x512 public/icon-512.png

# Apple Touch Icon
magick brand/icon-master.png -resize 180x180 public/apple-touch-icon.png

# Favicon (PNG + ICO)
magick brand/icon-master.png -resize 32x32 public/favicon-32.png
magick brand/icon-master.png -resize 32x32 public/favicon.ico
```

This resize step is done **after human review** of the generated master — it is
a separate manual or automated step, not part of `generate-branding.mjs` itself.

### Error codes

- **429** — Quota exceeded or billing not enabled. Script logs a clear message and continues.
- **Other non-200** — Logs HTTP status + first 200 chars of response body, then continues.
