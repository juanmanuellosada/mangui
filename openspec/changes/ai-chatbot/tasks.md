## 1. Dependencias y verificación de API

- [x] 1.1 `npm i @ai-sdk/react`.
- [x] 1.2 Confirmar la API de AI SDK v6 con context7 (`vercel:ai-sdk`): `useChat`, `streamText`, `tool`, `convertToModelMessages`, `toUIMessageStreamResponse`, `stepCountIs`, y cómo se hacen client tools (sin `execute`) + `addToolResult`.

## 2. Tool handlers (lectura, RLS por sesión)

- [x] 2.1 Crear `src/lib/ai/tools.ts` (o carpeta) con helpers que usan el cliente de sesión y reutilizan funciones existentes:
  - `obtener_saldos` (vista `account_balances`)
  - `estadisticas_gastos` (stats.ts: summaryTotals, categoryDistribution, incomeExpenseSeries)
  - `buscar_movimientos` (movements.ts: fetchMovements; cap 50)
  - `pagos_futuros` (helper que orquesta recurring.ts + installments.ts + cards.ts)
  - `resumenes_tarjeta` (cards.ts: listCardCycles)
  - `estado_presupuestos` (budgets.ts), `estado_metas` (goals.ts)
  - Cada tool: schema Zod de input, ejecuta server-side con sesión, devuelve datos compactos. NUNCA acepta user_id del modelo.

## 3. Endpoint de chat

- [x] 3.1 `src/app/api/ai/chat/route.ts`: auth (401 si no hay user); rate limit (si no `ai_unlimited`, contar `ai_usage` del día, 429 si ≥30); registrar 1 fila `ai_usage` por mensaje del usuario.
- [x] 3.2 `streamText({ model: gemini-2.5-flash, system, messages: convertToModelMessages(messages), tools, stopWhen: stepCountIs(6) })` → `toUIMessageStreamResponse()`. System prompt acotado al dominio financiero del usuario y a es-AR; instruye rechazar pedidos fuera de alcance.
- [x] 3.3 Registrar las tools de lectura (con `execute`) y `crear_movimiento` como **client tool** (sin `execute`).

## 4. UI del chat en /ia

- [x] 4.1 Reescribir `src/app/(app)/ia/page.tsx` como chat (`useChat`): lista de mensajes, input, streaming, estados de carga/errores (incl. 429 límite y error genérico). Mostrar uso del día (X/30 o "ilimitado").
- [x] 4.2 Render de tool-calls: lecturas → resultado compacto/legible; `crear_movimiento` → tarjeta de confirmación con `MovementForm` precargado. Al confirmar: insertar el movimiento (reusar patrón actual + invalidar `MOVEMENTS_KEY`/`BALANCES_KEY`/`ACCOUNTS_KEY`) y `addToolResult` con el resultado; al cancelar, `addToolResult` con cancelado.
- [x] 4.3 Aplicar `ui-ux-pro-max` para la UI del chat, consistente con el sistema bespoke.

## 5. Repointar accesos de IA y limpieza

- [x] 5.1 El acceso de IA (`useQuickAdd().open("ai")`, bottom-nav, "Cargar con IA") lleva al chat `/ia`. Quitar el AI parse sheet del flujo (`ai-quick-add-sheet.tsx`).
- [x] 5.2 Si `/api/ai/parse-movement` queda sin referencias, eliminarlo. Mantener el quick-add manual (movimiento/transferencia).

## 6. Verificación

- [x] 6.1 `tsc --noEmit` + `next build` sin errores.
- [ ] 6.2 QA: consultas (saldos, gastos por categoría, pagos futuros), crear movimiento por chat con confirmación, límite diario, y verificación de aislamiento (las tools solo devuelven datos del usuario).
