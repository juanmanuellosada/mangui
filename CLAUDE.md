# CLAUDE.md — mangui

App de finanzas personales para Argentina, en producción en [www.mangui.com.ar](https://www.mangui.com.ar) (+ app en Google Play vía TWA). Deploy automático a Vercel en cada push a `main`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Supabase (Postgres + Row Level Security) — auth, DB, storage
- TanStack Query v5 — data fetching en cliente
- Tailwind CSS v4 + shadcn/ui (componentes propios en `src/components/ui`)
- react-hook-form + zod — formularios
- Vercel AI SDK + Gemini (`gemini-2.5-flash`) — IA hosteada (Manguito)
- Vitest — tests
- Resend (email), web-push (notificaciones), MercadoPago (suscripciones)

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build        # build de producción
npm run lint          # eslint
npm run typecheck   # tsc --noEmit
npm test               # vitest run
npm run format:check  # prettier --check .
```

CI (`.github/workflows/ci.yml`) corre `lint`, `typecheck` y `test` en cada push y PR a `main`. No incluye `build` (necesita env vars) ni `format:check` (config nueva, todavía no aplicada al código existente).

## Estructura

```
src/
  app/
    (marketing)/    → landing pública (/)
    (auth)/         → login, registro, recuperar contraseña
    (app)/          → app protegida (/app/*)
    api/            → route handlers (IA, cron, MercadoPago, etc.)
    actions/        → server actions
  components/       → por dominio (movements/, accounts/, cards/, budgets/, goals/, rules/, recurring/, stats/, ai/, ui/, ...)
  lib/              → dominio: supabase/, ai/, inflation/, rates/, marketing/, date-utils.ts, plans.ts, etc.
supabase/
  migrations/       → 44 migraciones SQL aplicadas
```

## Patrones clave

- **Supabase clients**: `@/lib/supabase/client` (browser, Client Components), `@/lib/supabase/server` (Server Components/Actions/Route Handlers, cookies), `@/lib/supabase/admin` (service role — **solo server-side**, bypassa RLS; usado para rate limiting de IA y jobs de cron).
- **Data fetching en cliente**: TanStack Query + `createClient()` de `supabase/client` dentro de Client Components (`"use client"`).
- **RLS**: todas las tablas de usuario están protegidas por policies sobre `user_id`. No asumas que el admin client es necesario — preferí el cliente normal (RLS) salvo que la operación lo requiera explícitamente.
- **Dinero**: columnas `numeric(18,2)` en Postgres. No usar floats para cálculos de montos en TS sin cuidado de precisión.
- **Zona horaria**: la app asume `America/Argentina/Buenos_Aires`. Usar `todayAR()` de `@/lib/date-utils` para la fecha "de hoy" en vez de `new Date()` directo.
- **Tests**: archivos `*.test.ts` junto al código (`src/lib/*.test.ts`), corridos con Vitest (`environment: "node"`).
- **Estilo de código**: sin punto y coma, comillas dobles (ver `.prettierrc`; no se corrió `prettier --write` sobre el código existente todavía).

## Reglas duras del producto

- **NO bots, nunca.** Nada de automatizar acciones del usuario (pagos, transferencias, etc.) sin confirmación explícita humana en cada paso.
- **IA hosteada y gratis** con límite diario por usuario (`check_and_increment_ai_usage`, ver `src/lib/ai/rate-limit.ts` y `supabase/migrations/0042_atomic_ai_usage.sql`). Usuarios premium/`ai_unlimited` no son bloqueados pero el uso se sigue registrando.
- **Español de Argentina únicamente** — copy, mensajes de error, nombres de variables de dominio en español rioplatense donde aplique.
