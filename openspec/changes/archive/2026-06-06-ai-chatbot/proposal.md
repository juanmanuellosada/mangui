## Why

Hoy la IA solo parsea un movimiento puntual. Un **chatbot** en `/ia` queda como interfaz común y permite mucho más: consultar las finanzas del usuario (saldos, gastos, pagos futuros, resúmenes, presupuestos/metas) y cargar movimientos por conversación. Todo estrictamente sobre **los datos del propio usuario** y con foco en seguridad.

## What Changes

- `/ia` pasa a ser un **chat con streaming** (interfaz única de IA). El acceso/botón de IA abre el chat; "cargar un gasto" se le pide al chat.
- Nuevo endpoint `POST /api/ai/chat` con **tool-calling** (`streamText` + tools, modelo `gemini-2.5-flash`). El modelo NO accede a la base directamente: solo invoca un set fijo de herramientas server-side.
- **Herramientas de lectura** (ejecutan con el cliente de sesión → RLS): saldos, estadísticas de gasto, búsqueda de movimientos, pagos futuros (recurrentes + cuotas futuras + vencimiento de tarjetas), resúmenes de tarjeta, presupuestos y metas.
- **Herramienta de escritura** `crear_movimiento`: **no** inserta sola; propone un borrador que el usuario **confirma** en el chat (reusa `MovementForm`); recién ahí se guarda.
- **Seguridad**: scoping por usuario vía RLS (user_id de la cookie, nunca del modelo), sin SQL libre, rate limit por usuario (reusa `ai_usage`, cuenta por mensaje del usuario; `ai_unlimited` lo saltea), tope de pasos de herramientas por mensaje, y system prompt acotado al dominio financiero del usuario.
- **BREAKING (UX)**: se reemplaza el quick-add de IA (parseo) por el chat. El quick-add manual (movimiento/transferencia) se mantiene. La ruta `/api/ai/parse-movement` queda obsoleta (se elimina si nada la usa).
- Nueva dependencia: `@ai-sdk/react` (para `useChat`/streaming).
- Chat **efímero**: no se persiste en el servidor.

## Capabilities

### New Capabilities
- `ai-chatbot`: asistente conversacional sobre las finanzas del usuario, con herramientas de lectura (scopeadas por RLS) y de escritura con confirmación, rate limit y aislamiento estricto por usuario.

### Modified Capabilities
<!-- La capability `ai-assistant` (límite por usuario, no guardar sin confirmación) aún no está promovida a specs/ (su change no fue archivado); este cambio la extiende vía la nueva capability ai-chatbot. -->


## Impact

- **UI**: `src/app/(app)/ia/page.tsx` (chat), nuevos componentes de chat en `src/components/ai/`. Repointar el acceso de IA (quick-add/bottom-nav/"Cargar con IA") al chat. Quitar el AI parse sheet del flujo.
- **API**: nuevo `src/app/api/ai/chat/route.ts` (streamText + tools). `src/app/api/ai/parse-movement/route.ts` queda obsoleto.
- **Lógica**: nuevas tool handlers en `src/lib/ai/` que reusan `stats.ts`, `cards.ts`, `budgets.ts`, `goals.ts`, `recurring.ts`, `installments.ts`, `movements.ts`, y la vista `account_balances`.
- **Datos**: sin migración nueva (reusa `ai_usage`/`ai_unlimited` de `0031`). Sin tablas de chat (efímero).
- **Deps**: agregar `@ai-sdk/react`.
- **Seguridad**: cliente de sesión (RLS) en todas las tools; confirmación para escrituras.
