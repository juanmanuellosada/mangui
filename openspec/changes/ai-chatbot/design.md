## Context

La IA actual (`/api/ai/parse-movement`) usa `generateObject` (sin streaming, sin tools) con `gemini-2.5-flash` y key del servidor. Existe infra reutilizable: cliente de sesión RLS (`src/lib/supabase/server.ts`), vista `account_balances`, y funciones puras: `stats.ts` (summaryTotals, categoryDistribution, incomeExpenseSeries), `cards.ts` (listCardCycles, nextCardPayment, currentCycleSummary), `budgets.ts` (computeBudgetProgress), `goals.ts` (computeGoalProgress), `recurring.ts` (computeNextRun), `installments.ts`, `movements.ts` (fetchMovements). `ai_usage` + `profiles.ai_unlimited` ya existen (migración 0031). AI SDK v6 (`ai`) instalado; falta `@ai-sdk/react`.

## Goals / Non-Goals

**Goals:**
- Chat en `/ia` con streaming y tool-calling sobre los datos del usuario.
- Lecturas scopeadas por RLS; escritura (crear movimiento) con confirmación explícita.
- Seguridad: imposible acceder a datos de otro usuario aunque el prompt sea adversarial.
- Rate limit y costo acotado.

**Non-Goals:**
- No persistir conversaciones (efímero).
- No SQL libre ni acceso del modelo a la base.
- No otras escrituras además de crear movimiento (pagar resumen / recurrentes quedan para después).
- No reescribir las funciones de cálculo existentes (se reutilizan).

## Decisions

### D1: streamText + tools, modelo gemini-2.5-flash
`POST /api/ai/chat` recibe los mensajes (UIMessages del `useChat`), arma `streamText({ model, system, messages: convertToModelMessages(...), tools, stopWhen: stepCountIs(6) })` y devuelve `toUIMessageStreamResponse()`. Verificar la API exacta de AI SDK v6 con context7 (`vercel:ai-sdk`).

### D2: Seguridad por capas (lo más importante)
- **Aislamiento**: cada tool obtiene el usuario con `supabase.auth.getUser()` (cookie) y consulta con el **cliente de sesión** (RLS). El `user_id` jamás viene de argumentos del modelo. No se usa el admin client en tools (salvo el insert de `ai_usage`).
- **Sin SQL libre**: solo herramientas parametrizadas con Zod; el modelo no puede componer queries.
- **System prompt** acotado: el asistente solo habla de las finanzas del usuario autenticado; rechaza pedidos fuera de dominio o de "otros usuarios"; aclara montos/fechas en es-AR.
- **Escritura con confirmación**: `crear_movimiento` es un tool SIN `execute` server-side (client tool / human-in-the-loop). El cliente intercepta la tool-call, muestra `MovementForm` precargado, y solo al confirmar el usuario inserta el movimiento (reusando el patrón actual de insert + invalidación de `MOVEMENTS_KEY`/`BALANCES_KEY`/`ACCOUNTS_KEY`) y devuelve el resultado al modelo vía `addToolResult`.
- **Rate limit**: antes de procesar, si el usuario no es `ai_unlimited`, contar `ai_usage` del día; si ≥ 30 → cortar con mensaje. Registrar 1 fila en `ai_usage` por mensaje del usuario.
- **Tope de pasos**: `stepCountIs(6)` para acotar round-trips de tools por mensaje (costo).

### D3: Contrato de herramientas (read = execute server-side con RLS)
- `obtener_saldos()` → saldos por cuenta + total (vista `account_balances`).
- `estadisticas_gastos({ desde, hasta, moneda? })` → totales (ingresos/gastos/neto) y top categorías (reusa stats.ts).
- `buscar_movimientos({ texto?, tipo?, desde?, hasta?, categoria?, cuenta?, limite? })` → lista acotada (reusa movements.ts; cap 50).
- `pagos_futuros({ hasta? })` → recurrentes próximos + cuotas futuras + próximos vencimientos de tarjeta (reusa recurring/installments/cards).
- `resumenes_tarjeta({ tarjeta? })` → ciclos/resúmenes (reusa listCardCycles).
- `estado_presupuestos()` / `estado_metas()` → progreso (reusa budgets/goals).
- `crear_movimiento({ tipo, monto, moneda, categoria?, cuenta?, fecha?, nota? })` → **client tool** (sin execute): abre confirmación.
Las tools devuelven datos compactos y amigables (no vuelcan tablas enteras); resuelven nombres de categoría/cuenta a partir de los datos del usuario.

### D4: `/ia` = chat (interfaz única)
`useChat` (`@ai-sdk/react`) con UI de mensajes + streaming. Render de tool-calls: las de lectura muestran un resultado compacto; `crear_movimiento` muestra la tarjeta de confirmación (MovementForm). Mostrar el uso del día (X/30) en algún lugar discreto. Repointar el acceso de IA (quick-add "ai", bottom-nav, "Cargar con IA") a `/ia`. Quitar el AI parse sheet del flujo; eliminar `/api/ai/parse-movement` si queda sin referencias. El quick-add manual (movimiento/transferencia) se mantiene.

## Risks / Trade-offs

- [Prompt injection vía datos del usuario] → el riesgo se limita a los propios datos del usuario (RLS); las tools nunca aceptan user_id del modelo. Mitigación: system prompt defensivo + no exponer secretos.
- [Costo por conversación mayor que un parseo] → rate limit por mensaje + `stepCountIs(6)` + Flash (centavos). 
- [API de AI SDK v6 cambió respecto de v4/v5] → confirmar `useChat`/`streamText`/`toUIMessageStreamResponse`/`convertToModelMessages`/`stepCountIs` con context7 antes de codear.
- [Tools que arman "pagos futuros" combinan varias fuentes] → encapsular en un helper en `src/lib/ai/` que orqueste recurring + installments + cards.

## Migration Plan

1. `npm i @ai-sdk/react`.
2. Helpers de tools en `src/lib/ai/` (reusan funciones existentes, cliente de sesión).
3. Route `/api/ai/chat` con streamText + tools + rate limit.
4. UI de chat en `/ia`; repointar accesos de IA; quitar parse sheet (y route si queda huérfana).
5. Build + QA (consultas + crear movimiento con confirmación + límite).
- **Rollback**: sin migración; revertir el código restaura el estado anterior. `ai_usage`/`ai_unlimited` ya existen.

## Open Questions

- Ninguna bloqueante. Confirmar API v6 al implementar.
