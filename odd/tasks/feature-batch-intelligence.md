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
- [ ] Implement financial health view.
- [ ] Implement suggested rules.
- [ ] Improve monthly reports.
- [ ] Implement intelligent notifications.
- [ ] Run full verification, push to main, and notify via ntfy.

## Evidence
- Suggested rules now suppress duplicates from existing `note contains` conditions when condition data is available, while retaining the rule-name fallback for existing callers.
- `RulesList` passes fetched `auto_rule_conditions` to the suggestion helper; suggestions still require the explicit `Crear` action to open a prefilled form.
- Focused suggestion tests cover condition-based duplicate suppression, the no-conditions fallback, and category dominance.
