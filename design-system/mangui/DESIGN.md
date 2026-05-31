# mangui — DESIGN.md (synthesized design spec)

> De-conflicted synthesis of the project's design skills (`.agents/skills/`): emil-design-eng, high-end-visual-design, impeccable, design-taste-frontend, redesign-existing-projects, gpt-taste, stitch-design-taste, minimalist-ui (+ image-to-code / imagegen art-direction principles), reconciled with `ui-ux-pro-max` and the mango brand.
> **North star:** playful-premium fintech for Argentina. Mango-with-sunglasses, done right. Not generic fintech. Not brutalist. Not corporate.
> This file + `MASTER.md` are the source of truth. When a page-specific file exists under `design-system/mangui/pages/`, it overrides these.

## 0. Direction decisions
- **Aesthetic:** playful-premium. Keep the mango brand (lime/green + orange), tasteful brand gradient (lime→orange, sparingly), warm neutrals. **Skip brutalist.** Borrow minimalist's editorial restraint + impeccable/emil's polish.
- **No image-gen tool in this environment** → apply the image-to-code/imagegen skills as *art-direction principles in code* (composition variety, hero cleanliness, section rhythm, anti-slop), not by generating mockups. If real mockups are provided later, match them faithfully.

## 1. Core taste principles (emil, high-end, impeccable, design-taste)
- Polish compounds: every shadow tint, easing curve, active state intentional.
- **Shadows tinted to background hue** (not pure black). Light: warm-stone tint over #FAFAF9. Dark: deep-teal tint over #0B1410. Depths: subtle `0 1px 2px /.05`, hover `0 4px 6px /.1`, modal `0 10px 15px /.1`, deepest `0 20px 25px /.15`. No harsh `shadow-xl` on small elements.
- **Hairline borders only** (1px), color `rgba(0,0,0,.06)` light / `rgba(255,255,255,.08)` dark. Never pure gray.
- **Double-bezel cards** (premium sections): outer shell subtle bg + hairline + `p-1.5/2` + `rounded-2xl`; inner core distinct bg + inset highlight + smaller radius. **Data-dense lists/tables: skip bezel**, use dividers.
- **Radius scale locked:** 4px inputs/small UI · 8–12px buttons/cards · 16px large cards · `rounded-full` only buttons/badges/avatars (never large containers). Cards max 16px; 24px+ only on big containers.
- **Spacing:** section `py-24`→`py-40` desktop, `clamp(3rem,8vw,6rem)` mobile; card padding 24–40px; gaps 8/16/24. Intentional, varied (slightly more bottom than top).
- **Font-weight hierarchy (IBM Plex Sans):** 300 meta · 400 body · 500 UI labels · 600 buttons/feature titles · 700 display. Calistoga display sparingly (hero, big balances).

## 2. Typography
- Body/UI **IBM Plex Sans**; display/big-numbers **Calistoga**; micro/mono optional IBM Plex Mono.
- Scale (clamped): H1 Calistoga `clamp(2rem,5vw,3.5rem)`/lh1.1/-0.02em/700 · H2 `clamp(1.5rem,4vw,2.5rem)`/lh1.15 · H3 Plex 600 18–24px · H4 16px 600 · Body 16px(15 mobile)/lh1.6/max 65ch · Small/UI 14px/500/0.02em · Micro 12px/0.05em.
- **Tabular figures (`tabular-nums`) on ALL money/amounts/rates/dates/columns.**
- No all-caps body (only ≤4-word labels/badges). No serif on data surfaces. Hero ≤3 lines. `next/font` + display:swap.

## 3. Color & theming
- Locked OKLCH in `globals.css`. Primary lime `#65A30D`(light)/`#84CC16`(dark); accent orange `#F97316`; success `#16A34A`; destructive `#DC2626`; bg `#FAFAF9`/`#0B1410`; fg `#1C1917`/`#F5F5F4`; muted stone; border subtle; ring lime.
- Dark = deep teal-charcoal (not pure black). Cards slightly lighter than bg for hierarchy. Brand colors not desaturated in dark.
- **One accent per page.** Brand gradient lime→orange only on CTAs/highlight/hero accent, **one gradient per page max.** No AI purple/blue gradients, no gradient text. Saturation <80%. Contrast AA (4.5:1 body, 3:1 large, 4.5:1 placeholders).
- Money color never alone: pair with +/− sign + icon. Income green, expense red, transfers neutral.

## 4. Motion & micro-interactions (emil + gpt-taste, web/CSS+Framer)
- **Animation decision:** actions done 100+/day (keyboard, command) → no animation; occasional (modals/toasts) → 200–300ms; rare/first-time → up to ~800ms delight. Purpose required (spatial/state/feedback), never "looks cool".
- Easing: entering/exiting `ease-out`; moving `ease-in-out`; default `ease-out`. Custom curves: `--ease-out:cubic-bezier(.23,1,.32,1)`, `--ease-drawer:cubic-bezier(.32,.72,0,1)`. **Never `ease-in` on UI.**
- Durations: press 100–160ms · tooltip 125–200 · dropdown 150–250 · modal 200–500.
- Components: button `:active scale(.97)`; popovers scale from trigger origin; toasts slide+fade (exit faster); scroll-reveal fade+translateY 8–16px, stagger 40–80ms.
- **Animate only transform/opacity** (GPU). Never width/height/top/left/margin. CSS for fixed motion, Framer for interruptible/spring (`stiffness 100, damping 10–20`, subtle bounce). `transition: all` banned — name properties.
- Respect `prefers-reduced-motion` (crossfade/instant, content always readable).

## 5. Layout
- DESIGN_VARIANCE 8 (asymmetric playful-premium). **No centered-everything hero**; use split/offset/asymmetric. **No 3-equal-column feature grids**; use 2-col zig-zag, asymmetric bento, or horizontal scroll.
- **Eyebrow restraint (most-violated):** max 1 small-uppercase-tracked eyebrow per 3 sections (hero counts). Prefer dropping it.
- Max 2 consecutive image+text zigzags. No split-header ("big headline left + explainer right") — stack vertically (65ch). Each layout family appears ≤1×/page; ≥5 families on a 9-section page.
- Bento: `grid-auto-flow:dense`, zero empty cells, card-count = content-count, 2–3 cells with real imagery/gradient. Mobile: all multi-col → 1-col <768px, gap 4/6.
- Hero top padding ≤`pt-24`; ≤4 hero text elements; nav single line 64–80px. `min-h-[100dvh]` not 100vh. No horizontal scroll. No nested box-in-box-in-box.

## 6. Component polish
- **Buttons:** primary solid lime / secondary outline / tertiary text-accent. Radius 8–12px (pill ok). Hover scale 1.02–1.05 + shadow (non-touch), active scale .97, visible lime focus ring. CTA = verb+object ≤3 words, one line. Trailing icons in own wrapper.
- **Inputs:** label above, helper in markup, error below + red border. Focus ring 3px lime. Placeholder 4.5:1 (no placeholder-as-label). Disabled opacity .5. Amounts tabular.
- **Cards:** only when elevation = real hierarchy; else dividers/negative space. Double-bezel for premium; simple for data. 12–16px radius, 24–40px padding, subtle→hover shadow, `-2px translateY` hover.
- **Dialogs/sheets:** overlay `rgba(0,0,0,.5)` + `blur(4px)`; container radius 16px, padding 32px, deepest shadow, max 500–600px / 90vw mobile; scale-from-center enter 300ms, fade-out 200ms; visible close + focus ring.
- **Tables/lists:** semantic, hairline `border-b`, generous padding, subtle hover tint, tabular numerics, mobile stack/scroll.
- **Empty states:** composed (icon + headline + brief + CTA), never blank. **Errors** inline/toast styled, never `alert()`.
- **Charts (evilcharts):** primary green main / orange secondary, light gridlines, legend+tooltip, responsive, light+dark configs, readable without color alone, skeleton while loading, styled empty state.

## 7. Anti-slop checklist (consolidated — AVOID)
Gradient text · default glassmorphism · hero-metric cliché · identical card grids · side-stripe borders · AI purple/blue glow · sketchy SVGs · diagonal stripes/noise on scroll · ghost-card (1px border + soft shadow together) · over-rounded cards (>16px) · centered-everything · eyebrow-on-every-section · 01/02/03 markers · overflow text · 3-equal-col rows · repeated layout families · 3+ consecutive zigzags · split-header default · empty bento cells · "scroll to explore"/bouncing chevrons · system/Inter/Roboto fonts for premium · serif on dashboards · all-caps body · hero >56px · letter-spacing < -0.04em · 4+ line hero · >3 font families · flat hierarchy · pure black bg · saturation >80% · multiple accents · mixed warm/cool grays · inconsistent shadow tints · random dark section in light page · invisible form text · AI copy clichés (Elevate/Seamless/Unleash/Next-Gen) · em-dash flourishes · fake-precise stats · placeholder names (John Doe/Acme/Nexus) · "Oops!" errors · Lorem Ipsum · animations on keyboard actions · purposeless motion · `transition:all` · `scale(0)` entries · `ease-in` UI · >300ms UI anim · missing `:active` · animating layout props · blur on scroll · GSAP everywhere · invisible focus · hover without `@media(hover)` · contrast <4.5:1 · missing alt · ignoring reduced-motion · fake technical pills/labels.

## 8. full-output-enforcement (pass to implementing agents)
No `// ...`/`// TODO`/"rest of code"/placeholder skeletons. Generate every deliverable completely. Lock deliverable count up front, cross-check before finishing. If near token limit, end at a clean breakpoint with `[PAUSED — X of Y complete, resume from: <section>]` and continue exactly there on "continue".

## 9. Implementation checklist (ship gate)
Typography (Plex+Calistoga, hierarchy, tabular money, 65ch, swap) · Color (locked tokens, teal-charcoal dark, one accent, tinted shadows, AA) · Layout (≤1 eyebrow/3, ≤2 zigzags, no centered hero, dense bento no empty cells, mobile 1-col, dvh, no h-scroll) · Components (button active .97, label-above inputs, bezel premium/divider dense, modal scale+blur, semantic tables, composed empty states) · Motion (no keyboard anim, named transitions, no scale(0)/ease-in, reduced-motion) · A11y (focus rings, `@media(hover)`, alt, keyboard, color-not-alone) · Code (no hardcoded px, semantic HTML, z-index scale, no dead code, deps in package.json, lucide not emoji as structural icons).
