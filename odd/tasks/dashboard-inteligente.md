# Dashboard inteligente

## Intent
Add a deterministic, read-only `Radar inteligente` widget to `/inicio` for users with accounts. It must highlight the most useful current spending signals and link to existing management pages without automating financial actions.

## Tasks

- [x] Build and test pure, deterministic signal selection for unusual charges, month-end spending pace, and future movements.
- [x] Render the client-side widget from existing movement/category data and place it on the dashboard when accounts exist.

## Constraints

- Use `todayAR()` for date boundaries.
- Limit the output to four ranked signals.
- Do not use an LLM or mutate financial data.
- Preserve existing dashboard widgets.

## Verification

- `npm test -- src/lib/dashboard/smart-dashboard.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `git diff --check`
- `npm run build`

## Evidence

- `npm test -- src/lib/dashboard/smart-dashboard.test.ts`: passed (3 tests).
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed (32 files, 442 tests).
- `git diff --check`: passed.
- `npm run build`: passed.
