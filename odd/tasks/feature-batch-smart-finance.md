# Smart finance feature batch

## Goal
Implement the selected follow-up features after debt paydown: intelligent saving goals, pending movements inbox, and shareable monthly reports.

## Scope
- Add useful, deterministic product features without automating user actions.
- Reuse existing data, routes, and design vocabulary.
- Keep each feature in small verified commits.

## Constraints
- Spanish Argentina copy.
- No bots or automatic user actions without explicit confirmation.
- Use existing Supabase/RLS client patterns.
- Do not commit `.codegraph/`.
- Push to `main` only after lint, typecheck, tests, diff-check, and build pass.

## Tasks
- [ ] Map current goals, movements/import/recurrent, and monthly report surfaces.
- [x] Implement objetivos de ahorro inteligentes.
- [x] Implement inbox de movimientos pendientes.
- [ ] Implement reportes mensuales compartibles.
- [ ] Run full verification, push to main, and notify via ntfy.

## Evidence
- Objetivos de ahorro inteligentes: added deterministic pace guidance and a behind-schedule warning for active saving goals, plus compact GoalCard copy. No contributions or movements are created.
- Verification passed: `npm test -- src/lib/goals.test.ts`, `npm run lint`, `npm run typecheck`, `npm test`, `git diff --check`, and `npm run build`.
- Inbox de movimientos pendientes: added the `/inicio` client widget gated to users with accounts. It queries due pending recurring occurrences with `todayAR()` using `[...OCCURRENCES_KEY, "pending"]` and delegates confirmation and skipping to `PendingInbox`; no action is automated.
