# Intelligence feature batch

## Goal
Implement the selected next features: financial health view, suggested rules, improved monthly reports, and intelligent notifications.

## Scope
- Add deterministic, user-controlled intelligence to existing Mangui surfaces.
- Reuse existing data and UI components where possible.
- Keep each feature in small verified commits.

## Constraints
- Spanish Argentina copy.
- No automated user actions without explicit human confirmation.
- No scraping/bots.
- Do not commit `.codegraph/`.
- Push to `main` only after lint, typecheck, tests, diff-check, and build pass.

## Tasks
- [ ] Map current health/radar, rules, reports, and notification surfaces.
- [x] Implement financial health view.
- [ ] Implement suggested rules.
- [x] Improve monthly reports.
- [ ] Implement intelligent notifications.
- [ ] Run full verification, push to main, and notify via ntfy.

## Evidence
- Suggested rules now suppress duplicates from existing `note contains` conditions when condition data is available, while retaining the rule-name fallback for existing callers.
- `RulesList` passes fetched `auto_rule_conditions` to the suggestion helper; suggestions still require the explicit `Crear` action to open a prefilled form.
- Focused suggestion tests cover condition-based duplicate suppression, the no-conditions fallback, and category dominance.
- Financial health metrics now derive saving rate, daily expense pace, and analyzed days from filtered totals and dates; open or future date ranges are capped by the injected Argentina reference date, without projected-account queries or an opaque score.
- Strict-TDD evidence: `npm test -- src/lib/financial-health.test.ts` failed before implementation because `./financial-health` did not exist, then passed with coverage for zero income, closed historical, future/open capped, and stable finite empty-range output.
- Verification passed: `npm run lint`, `npm run typecheck`, `npm test` (35 files, 453 tests), `git diff --check`, and `npm run build`.
- Monthly reports now derive non-future movement months in descending order, including income-only months; focused tests cover ordering, future exclusion, and income-only availability.
- `WrappedSheet` provides a compact selector over available report months, uses the selected month for all metrics and PNG sharing, and its copy describes a calculated summary rather than AI-generated content.
- Estadísticas now opens the navigable Wrapped history via `Ver resúmenes mensuales` while retaining direct PNG sharing and Markdown report download.
- Verification passed: `npm test -- src/lib/wrapped.test.ts` (14 tests), `npm run lint`, `npm run typecheck`, `npm test` (35 files, 456 tests), `git diff --check`, and `npm run build`.
