## Why

Hoy la sección IA exige que cada usuario cargue su propia API key de un proveedor (BYO key). Eso genera fricción y desconfianza ("¿por qué me piden una key?") y frena la adopción de la única función de IA: interpretar texto libre y armar un borrador de movimiento. Conviene ofrecer la IA **incluida y gratis**, con una sola key del lado del servidor, controlando costo/abuso con un límite por usuario.

## What Changes

- **BREAKING**: se elimina el flujo BYO key. El usuario ya no carga ni elige proveedor/modelo. La IA usa una key del servidor (env var) y el modelo `gemini-2.5-flash`.
- La key vive solo en el servidor (`GOOGLE_GENERATIVE_AI_API_KEY`), nunca llega al cliente. El endpoint sigue exigiendo login.
- **Límite por usuario**: 30 interpretaciones por día. Usuarios marcados como `ai_unlimited` lo saltean.
- **Tracking de uso**: tabla `ai_usage` (una fila por llamada) para contar el uso diario y mostrarlo.
- La sección `/ia` pasa a ser **informativa**: explica que la IA viene incluida y muestra el uso del día (ej. 12/30) o "ilimitado".
- Limpieza: se quitan los inputs y acciones de BYO key (`saveAiSettings`, `removeAiKey`, `getDecryptedApiKey`, encriptación de key de usuario). La tabla `user_ai_settings` queda en desuso (no se borra para no perder datos).
- `.env.example` y manejo de errores actualizados (sin `no_key`; nuevo `rate_limited`).

## Capabilities

### New Capabilities
- `ai-assistant`: interpretación de movimientos por IA servida por la app (key del servidor), con límite de uso por usuario, flag de uso ilimitado y panel informativo de uso.

### Modified Capabilities
<!-- Ninguna spec previa de IA. -->

## Impact

- **UI**: `src/app/(app)/ia/page.tsx` (reescritura a informativa), `src/components/ai/ai-quick-add-sheet.tsx` (manejo de errores: quitar `no_key`, agregar `rate_limited`).
- **API**: `src/app/api/ai/parse-movement/route.ts` (key del server + modelo Gemini Flash + rate limit + log de uso; quitar decrypt y branching de proveedor).
- **Acciones**: `src/app/actions/ai-settings.ts` (quitar BYO, agregar `getAiUsageToday`/estado de cuota).
- **Datos**: nueva migración — `profiles.ai_unlimited boolean default false` + tabla `ai_usage` (con RLS). `user_ai_settings` queda sin uso.
- **Config/Ops**: setear `GOOGLE_GENERATIVE_AI_API_KEY` en Vercel (paso manual del usuario). `crypto.ts` y `APP_ENCRYPTION_KEY` quedan sin uso si nada más los usa.
