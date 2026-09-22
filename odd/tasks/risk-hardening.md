# Risk hardening

## Goal
Resolve the first bounded set of implementation risks identified in the architecture review without touching unrelated local changes.

## Scope
- Harden account deletion Storage cleanup so user-owned files are not left behind when Storage paths contain nested folders.
- Keep changes limited to the account deletion surface and focused tests.
- Do not refactor large UI components or run global formatting in this slice.

## Non-goals
- No changes to current card payment local edits.
- No global lint warning cleanup.
- No offline queue expansion.
- No cron architecture rewrite.
- No commits/pushes/PRs unless explicitly requested.

## Tasks
- [x] Inspect local git state and identify protected user changes.
- [x] Add a testable recursive Storage purge helper for account deletion.
- [x] Update account deletion to use the recursive purge helper.
- [x] Normalize account deletion file formatting only where edited.
- [x] Run focused tests and summarize remaining checks.

## Evidence
- Protected local changes observed before implementation: `.gitignore`, `src/components/cards/cards-list.tsx`, untracked `.codegraph/`.
- Changed files in this slice: `src/app/actions/account.ts`, `src/app/actions/account.test.ts`, `odd/tasks/risk-hardening.md`.
- Worker validation:
  - `npm test -- src/app/actions/account.test.ts`: passed, 3 tests.
  - `npm run typecheck`: passed.
  - `git diff --check -- src/app/actions/account.ts src/app/actions/account.test.ts`: passed.
- No commit created; user did not request commits.

## Remaining risks
- Recursive folder detection relies on Supabase Storage returning folder-like entries with `id: null`.
- Broader risks still pending: lint warning debt, large component decomposition, offline write scope, cron scaling review.
