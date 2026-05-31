# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** mangui
**Generated:** 2026-05-30 22:08:14
**Category:** Banking/Traditional Finance

---

## Global Rules

### Color Palette — mangui BRAND (overrides the generic fintech-blue recommendation)

The brand is fixed by the logo (mango with sunglasses): **lime/green + orange**. Do NOT use the generic trust-blue. The theme already lives in `src/app/globals.css` as OKLCH tokens — these hex values are the reference intent.

| Role | Hex | CSS Variable | Notes |
|------|-----|--------------|-------|
| Primary (brand green) | `#65A30D` | `--primary` | lime-600; main actions, links |
| Primary light | `#84CC16` | — | lime-500; highlights, brand accents |
| On Primary | `#FFFFFF` | `--primary-foreground` | |
| Accent / CTA (orange) | `#F97316` | `--accent` | mango orange; secondary CTAs, emphasis |
| Positive / income | `#16A34A` | `--success` | green-600; ingresos, saldo positivo |
| Negative / expense | `#DC2626` | `--destructive` | red-600; gastos, saldo negativo, borrar |
| Background (light) | `#FAFAF9` | `--background` | warm near-white |
| Background (dark) | `#0B1410` | `--background` (dark) | deep teal-charcoal (brand teal) |
| Foreground | `#1C1917` / `#F5F5F4` | `--foreground` | high-contrast text per mode |
| Muted | warm stone | `--muted` | |
| Ring (focus) | `#84CC16` | `--ring` | lime focus ring |

**Color Notes:** Mango brand = lime/green primary + orange accent on warm-neutral surfaces (teal-charcoal in dark). Money semantics: income/positive green, expense/negative red — but never rely on color alone (add +/− sign, icon, tabular figures). Keep the playful brand in accents/illustration; keep the financial data surfaces clean and high-contrast for trust.

### Typography

- **Heading Font:** Calistoga (warm, rounded display) — for hero/section headings and big balance numbers, giving the friendly mango personality. Use sparingly.
- **Body / UI Font:** IBM Plex Sans — trustworthy, financial; great legibility.
- **Numbers / money:** ALWAYS use tabular figures (`font-variant-numeric: tabular-nums` / Tailwind `tabular-nums`) on balances, amounts, rates and tables to prevent layout shift and align columns.
- **Mood:** trustworthy + warm. Professional financial body, friendly display accents.

### Platform / Stack note (this project is WEB, not React Native)

The skill's mobile guidance (Reanimated, BlurView, haptics, FAB) maps to web equivalents:
- Animations → CSS transitions / Framer Motion springs (respect `prefers-reduced-motion`).
- Glassmorphism nav → `backdrop-blur` + translucent bg.
- Haptic/scale-press → subtle CSS `scale(0.97)` active state + 150–250ms transitions.
- **Navigation:** desktop ≥1024px = persistent left **sidebar**; mobile = bottom nav (≤5 top-level items: Inicio, Movimientos, Cuentas, Stats, Más). Don't mix patterns at the same level.
- Mobile-first, installable PWA; respect safe areas (`env(safe-area-inset-*)`) for the bottom nav.
- **Google Fonts:** [IBM Plex Sans + IBM Plex Sans](https://fonts.google.com/share?selection.family=IBM+Plex+Sans:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #059669;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #1E40AF;
  border: 2px solid #1E40AF;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0F172A;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px #1E40AF20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** SaaS Mobile (High-Tech Boutique)

**Keywords:** saas, electric blue, gradient, fintech, spring animation, dual font, glassmorphism, boutique, premium, calistoga, inter, mono, tactile, haptic, bento

**Best For:** B2B SaaS mobile dashboards, fintech apps, developer tool mobile companions, marketing analytics apps, HR/operations apps, modern business productivity

**Key Effects:** Spring animations (mass:1 damping:15 stiffness:120); gradient buttons (0052FF→4D7CFF); scale press 0.96→1.0 with haptics; floating FAB with gentle bobbing (Reanimated); glassmorphism BlurView navigation bars; staggered fade-in entrance (Y:20→0 + opacity:0→1); pulsing status dot on section badges; layout transitions (LayoutAnimation or Reanimated entering)

### Page Pattern

**Pattern Name:** App Store Style Landing

- **Conversion Strategy:** Show real screenshots. Include ratings (4.5+ stars). QR code for mobile. Platform-specific CTAs.
- **CTA Placement:** Download buttons prominent (App Store + Play Store) throughout
- **Section Order:** 1. Hero with device mockup, 2. Screenshots carousel, 3. Features with icons, 4. Reviews/ratings, 5. Download CTAs

---

## Anti-Patterns (Do NOT Use)

- ❌ Playfulness that undermines trust — the mango brand IS playful, but keep it in illustration/accents/microcopy. Financial data (balances, amounts, statements) must stay clean, precise, high-contrast. Never childish on money surfaces.
- ❌ Poor security UX (e.g. exposing data, unclear auth/destructive actions)
- ❌ AI purple/pink gradients (use the mango lime→orange gradient instead, sparingly)
- ❌ Landing as literal "App Store" page — this is a PWA: replace App/Play Store buttons with "Crear cuenta" + "Instalar app" (PWA install) + "Ver demo"; keep device mockups, screenshots, and ratings/social-proof.

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
