## Why

Cuando el usuario menciona una cuenta por su nombre parcial ("el Santander", "balanz"), los flujos de IA fallan de dos maneras: no detectan la cuenta, o detectan **otra distinta**. Con nombres de cuenta largos —que es el caso real de los usuarios— el problema es sistemático.

La causa no es una sola. Al modelo se le manda una lista de nombres pelados y se le pide que reproduzca "el nombre EXACTO"; el matcher que traduce ese nombre a un id usa substring bidireccional, que falla con parciales no contiguos y produce falsos positivos según el orden del array; y cuando falla, falla en silencio. En el chat incluso cae a la primera cuenta del usuario sin ningún aviso, lo que puede guardar plata en la cuenta equivocada.

## What Changes

- **Se elimina el fallback silencioso a la primera cuenta** en el borrador del chat. Si la cuenta no se resuelve, el borrador queda sin cuenta y visible, igual que ya hace la categoría.
- **Cambia el contrato con el modelo en la extracción de movimientos**: la lista de cuentas pasa a ser numerada y con metadata (tipo y moneda), y el modelo devuelve un **índice** en vez de un string libre. Deja de tener que reproducir de memoria un nombre largo. **BREAKING** para el schema de `extract-movement` (se mantiene fallback por nombre para respuestas que igual devuelvan string).
- **Se unifica la resolución nombre → id en un único resolver compartido**, que puntúa por cobertura de tokens en lugar de substring, con umbral de confianza, desempate determinista y una señal explícita de "no pude resolver" distinguible de "resolví con baja confianza". Reemplaza cuatro implementaciones duplicadas y excluye cuentas ocultas.
- **Se agrega aprendizaje de cuenta** (`account_learning`): el sistema aprende de los movimientos ya confirmados qué cuenta corresponde a cada contexto —categoría + moneda, y comercio— y usa ese historial como un término más del puntaje del resolver, no como una regla aparte. Así solo desempata cuando lo detectado se parece al menos parcialmente, que es el comportamiento buscado.
- **Se agrega una utilidad de normalización de texto compartida**, hoy duplicada a mano en once archivos.

No cambia nada del modelo de confirmación: el borrador lo sigue confirmando siempre el usuario.

## Capabilities

### New Capabilities
- `ai-account-resolution`: cómo los flujos de IA determinan a qué cuenta pertenece un movimiento — el contrato por índice con el modelo, el resolver por puntaje con umbral de confianza, el prior aprendido del historial confirmado, y la precedencia entre esas señales y la elección manual del usuario.

### Modified Capabilities
- `ai-chatbot`: el requirement de escritura con confirmación se refuerza — el borrador propuesto NO puede rellenar una cuenta adivinada cuando la resolución falló; debe quedar vacía y visible.

## Impact

**Código afectado**

- `src/lib/ai/extract-movement.ts` — schema y prompt (lista numerada, índice de cuenta)
- `src/app/api/ai/extract-movement/route.ts` — forma del body de `accounts`
- `src/components/movements/ai-fill-bar.tsx` — deja de mandar solo nombres
- `src/components/movements/movement-form.tsx` — consumo del índice; elimina `_norm`/`matchByName`
- `src/components/ai/ai-chat.tsx` — elimina el fallback a `accounts[0]`; elimina `normalizeStr`/`findIdByName`
- `src/lib/ai/tools.ts` — usa el resolver compartido en `buscar_movimientos` y `resumenes_tarjeta`
- `src/components/cards/import-statement-flow.tsx` — usa el resolver compartido
- `src/components/quick-add-provider.tsx` — escritura del aprendizaje en el `onSuccess`
- Nuevos: utilidad de normalización, resolver, módulo de aprendizaje de cuenta y su hook

**Base de datos**

- Migración nueva (`0058`): tabla `account_learning` con RLS por `user_id` y RPC `bump_account_learning` con `SECURITY DEFINER` scoped por `auth.uid()`, siguiendo el patrón ya probado de `category_learning` (`0045`).

**Dependencias**

- Ninguna nueva. El puntaje por tokens se implementa en el repo; no se incorpora librería de fuzzy matching ni `pg_trgm`.

**Riesgos**

- El cambio de schema de `extract-movement` es el punto sensible: si el modelo devuelve un índice fuera de rango o un string, el fallback tiene que cubrirlo sin romper la carga.
- El prior aprendido puede afianzar un error si el usuario confirmó movimientos mal categorizados; el umbral mínimo de repeticiones y el hecho de que solo desempata (nunca decide solo) acotan el daño.

**Fuera de alcance**

- Campo `alias`/`short_name` en `accounts` (evaluado; queda como complemento futuro).
- Paginación de movimientos.
- Unificar las dos familias de normalización del repo (`normalizeNote`/`extractKeyword` vs. NFD).
