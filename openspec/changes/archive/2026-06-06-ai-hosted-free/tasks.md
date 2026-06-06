## 1. Datos (migración Supabase)

- [x] 1.1 Nueva migración: `profiles.ai_unlimited boolean NOT NULL DEFAULT false`.
- [x] 1.2 Tabla `ai_usage` (id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, model text, created_at timestamptz default now()) + índice `(user_id, created_at)`. RLS: SELECT propio; INSERT vía service role (admin) en el endpoint.
- [x] 1.3 Actualizar `database.types.ts` (nueva tabla + columna).

## 2. API route (key del server + rate limit)

- [x] 2.1 En `src/app/api/ai/parse-movement/route.ts`: quitar lectura/decrypt de la key del usuario y el branching de proveedor. Usar `GOOGLE_GENERATIVE_AI_API_KEY` del env con `gemini-2.5-flash`. Error 500 claro si falta la env.
- [x] 2.2 Antes de inferir: obtener el usuario; si NO es `ai_unlimited` (de `profiles`), contar filas de `ai_usage` del día; si ≥ 30 → 429 con code `rate_limited` y mensaje. No llamar al modelo.
- [x] 2.3 Tras éxito: insertar fila en `ai_usage` (admin client). Mantener el armado de contexto (categorías/cuentas) y el schema del borrador.
- [x] 2.4 Manejar error de cuota/upstream del proveedor con mensaje amable.

## 3. UI

- [x] 3.1 Reescribir `src/app/(app)/ia/page.tsx` a informativa: cómo se usa, y uso del día (consumidas/tope o "ilimitado"). Quitar inputs de proveedor/modelo/key.
- [x] 3.2 `src/components/ai/ai-quick-add-sheet.tsx`: quitar el manejo de `no_key`; agregar manejo de `rate_limited` (aviso de límite diario) y error genérico.

## 4. Acciones y limpieza

- [x] 4.1 `src/app/actions/ai-settings.ts`: quitar `saveAiSettings`, `removeAiKey`, `getDecryptedApiKey`. Agregar `getAiUsageToday()` → `{ used, limit, unlimited }`.
- [x] 4.2 Verificar usos de `crypto.ts` / `APP_ENCRYPTION_KEY`: sin referencias → eliminado `crypto.ts`, `APP_ENCRYPTION_KEY` quitado de `.env.example`. Tabla `user_ai_settings` no tocada.
- [x] 4.3 Actualizar `.env.example`: documentar `GOOGLE_GENERATIVE_AI_API_KEY`; eliminado bloque BYO/encryption.

## 5. Verificación y ops

- [x] 5.1 `tsc --noEmit` + `next build` sin errores. Grep: sin referencias a `no_key`, `getDecryptedApiKey`, `saveAiSettings`, `api_key_encrypted` en app code.
- [x] 5.2 Migración `0031` aplicada a prod; `GOOGLE_GENERATIVE_AI_API_KEY` cargada en Vercel por el usuario. Validado en uso.
