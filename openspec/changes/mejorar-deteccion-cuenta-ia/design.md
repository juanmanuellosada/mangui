## Context

Hoy la cuenta de un movimiento propuesto por IA se resuelve así: al modelo se le manda `accounts: string[]` (nombres pelados), el prompt le pide "el nombre EXACTO de la lista", y el string que devuelve se traduce a un id con un matcher que hace igualdad normalizada y, si falla, substring bidireccional (`a.includes(b) || b.includes(a)`) tomando el primer match del array.

Ese matcher está copiado en cuatro lugares con variaciones menores: `movement-form.tsx:143`, `ai-chat.tsx:41`, `lib/ai/tools.ts:31` y `import-statement-flow.tsx:68` (este último solo-exacto). Ninguno tiene tests.

Tres consecuencias, todas reportadas por el usuario:

- Un parcial no contiguo no matchea: `"Santander Visa"` contra `Santander Río - Visa Signature` falla en los dos sentidos del `includes`.
- El sentido `hint.includes(nombre)` genera falsos positivos: si existen `Visa` y `Visa Santander Platinum`, la corta se lleva el match cuando viene antes en el array, y el orden es `created_at`, o sea arbitrario.
- La falla es silenciosa y asimétrica: `movement-form` no setea nada; `ai-chat` cae a `accounts[0] ?? ""`, la primera cuenta creada, sin ninguna señal visual.

Restricciones que condicionan el diseño:

- El cliente **no tiene los movimientos en cache** cuando se crea uno: `MovementForm` solo carga reglas, condiciones y `category_learning`. No existe `use-movements.ts`. Cualquier "mirar el historial" desde el form implicaría una query de 500–2000 filas en el camino crítico.
- No hay ninguna utilidad de normalización compartida (el snippet NFD está duplicado a mano en once archivos), ni función de similitud, ni dependencia de fuzzy matching, ni `pg_trgm`.
- Ya existe un patrón probado de aprendizaje incremental: `category_learning` (migración `0045`) con tabla agregada + RPC `SECURITY DEFINER` scoped por `auth.uid()` + escritura fire-and-forget desde el browser + hook de React Query.

## Goals / Non-Goals

**Goals:**

- Que el usuario pueda nombrar una cuenta parcialmente y el sistema acierte.
- Que cuando el sistema no esté seguro, lo diga en vez de adivinar.
- Que el historial de movimientos ya confirmados desambigüe los casos parciales, sin costo en el camino crítico de creación.
- Una sola implementación de resolución, con tests.

**Non-Goals:**

- Campo `alias` / `short_name` en `accounts`. Se evaluó: es determinístico y le gana a cualquier heurística, pero exige carga manual por cuenta. Queda como complemento futuro.
- Paginación de movimientos.
- Unificar las dos familias de normalización del repo (`normalizeNote`/`extractKeyword` de `rules.ts`, que quita números y puntuación pero no acentos, vs. el NFD de los matchers). Conviven.
- Cambiar el modelo de confirmación: el borrador lo sigue confirmando el usuario siempre.

## Decisions

### 1. El modelo devuelve un índice, no un nombre

`extract-movement` pasa a mandar la lista numerada con tipo y moneda, y el schema devuelve `cuenta_idx: number | null`.

```
Cuentas:
[0] Santander Río - Visa Signature (tarjeta de crédito, ARS)
[1] Balanz - Comitente USD (inversión, USD)
```

**Por qué**: el problema de origen es que le pedimos al modelo reproducir un string largo de memoria. Elegir de una lista numerada es una tarea estrictamente más fácil y verificable. Además la metadata le da con qué desambiguar dos cuentas de nombre parecido, algo que hoy no tiene (la tool `obtenerSaldos` del chat sí la expone; la extracción no).

**Alternativas consideradas**: `z.enum` con los nombres — obliga a que el nombre sea válido pero el modelo igual tiene que reproducirlo entero, y el enum se arma en runtime desde datos del usuario, lo que complica el schema. Devolver el `id` (uuid) — el modelo alucina uuids con facilidad y no aporta nada sobre el índice.

**Compatibilidad**: se mantiene `cuenta: string | null` como campo de fallback. Si el índice viene fuera de rango o ausente y hay string, se cae al resolver de la decisión 2. El índice se valida siempre contra el largo de la lista efectivamente enviada (que está capada en 100).

### 2. Puntaje por cobertura de tokens, no substring

Un resolver compartido nuevo reemplaza los cuatro matchers. Firma conceptual:

```
resolveAccount(hint, candidates, context) → { accountId, score } | { unresolved: true }
```

Normalización compartida: lowercase → NFD → strip diacríticos → no-alfanumérico a espacio → colapsar espacios → trim. Tokenización por espacio, descartando tokens de menos de 2 caracteres.

Puntaje de un candidato:

- `coverage` = proporción de tokens del hint presentes en el nombre de la cuenta. Un token del hint matchea un token del nombre si el del nombre **empieza con** el del hint (así `"sant"` matchea `santander`).
- `specificity` = proporción de tokens del nombre que fueron matcheados. Penaliza al candidato que matchea un nombre largo con un solo token.
- `score = 0.7 × coverage + 0.3 × specificity`, con atajo a `1.0` si los nombres normalizados son iguales.

Verificación contra los casos reales:

| hint | candidato | coverage | specificity | score |
|---|---|---|---|---|
| `Santander Visa` | `Santander Río - Visa Signature` | 2/2 | 2/4 | **0.85** |
| `Santander Visa` | `Santander Río - Caja de ahorro` | 1/2 | 1/5 | 0.41 |
| `Visa Santander Platinum` | `Visa Santander Platinum` | 3/3 | 3/3 | **1.00** |
| `Visa Santander Platinum` | `Visa` | 1/3 | 1/1 | 0.53 |

Los dos casos que hoy fallan quedan resueltos, y el falso positivo por orden de array desaparece porque el desempate es por puntaje, no por posición.

**Umbrales**: se resuelve si el mejor puntaje supera `0.45` **y** le saca al segundo una diferencia de al menos `0.15`. Si no, `unresolved`. Los dos números son constantes exportadas y testeadas, ajustables sin tocar la lógica.

**Alternativas consideradas**: Levenshtein — mide distancia de edición, no cobertura; `"Santander Visa"` está lejísimos en ediciones de `Santander Río - Visa Signature` aunque semánticamente sea un match perfecto. `fuse.js` — resuelve el problema pero suma una dependencia para ~60 líneas de lógica que además queremos testear con nuestros propios casos. `pg_trgm` — mueve la resolución al servidor y agrega un round trip en el camino crítico del form.

El resolver excluye cuentas ocultas (`is_hidden`), que hoy ninguno de los cuatro matchers filtra.

### 3. El prior aprendido es un término del puntaje, no una regla aparte

El historial suma hasta `+0.20` al puntaje del candidato aprendido para el contexto, escalado por cantidad de repeticiones y saturado en ese tope.

**Por qué**: el usuario pidió explícitamente que el historial se aplique "siempre y cuando lo que haya detectado coincida al menos parcialmente". Como término del puntaje, ese guard sale gratis y sin condicionales:

- Hint que no se parece a nada (score ≈ 0) + prior máximo = 0.20 < 0.45 → sigue sin resolver. El prior no puede inventar una cuenta.
- Hint parcialmente parecido (0.41) + prior = 0.61 → resuelve. Que es exactamente el caso que el usuario quiere ganar.
- Hint que apunta claramente a otra cuenta (0.85) contra un prior sobre una que puntúa 0.41 → gana el 0.85. El prior no pisa una señal fuerte.

**Alternativa considerada**: una regla `if (matchParcial && hayAprendido) usarAprendido`. Es lo que el usuario propuso literalmente, pero exige definir "parcial" con un umbral propio, y cada caso nuevo agrega una rama. Como puntaje, un solo número gobierna los tres comportamientos.

**Caso sin hint**: cuando el modelo no devolvió ninguna cuenta pero sí hay un prior fuerte para el contexto, no se completa el campo en silencio —lo prohíbe el requirement de no adivinar—. Se muestra como **sugerencia descartable**, reusando el patrón `learnHint` que ya existe para categorías en `movement-form.tsx:732`.

### 4. Tabla agregada incremental, no lectura del historial

`account_learning` mantiene el agregado, alimentada al confirmar cada movimiento.

**Por qué**: el form no tiene movimientos en cache y traerlos costaría 500–2000 filas en el camino crítico de creación. El agregado se lee con una query chica cacheada por React Query, igual que `category_learning`. El patrón ya está probado en producción y tiene tests.

**Alternativa considerada**: derivar el prior en el cliente desde los movimientos. Sería cero migraciones, pero el costo de la query en el camino crítico lo descarta; y una vista SQL agregada por categoría+cuenta tampoco existe (`0007_views.sql` solo agrega por cuenta).

### 5. Una tabla con dos tipos de contexto, y un solo RPC

```sql
create table account_learning (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  context_kind text not null check (context_kind in ('category_currency','merchant')),
  context_key  text not null,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  hit_count    int not null default 1,
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, context_kind, context_key, account_id)
);
create index on account_learning(user_id, context_kind, context_key);
```

`context_key` es `"<category_id>:<currency>"` para `category_currency`, y el resultado de `merchantKey(note)` para `merchant`.

**Por qué dos contextos**: `category_currency` cubre el caso que reportó el usuario ("rendimientos en USD siempre a esa cuenta"). `merchant` cubre el complementario ("Netflix siempre sale de la Visa"), reusando `merchantKey` de `category-learning.ts:20`, que ya está testeado.

**Por qué una sola tabla**: las dos claves tienen forma idéntica y se consultan juntas. Dos tablas duplicarían RLS, índice, RPC y hook sin ganar nada.

**Un solo RPC**: `bump_account_learning(p_category_id, p_currency, p_merchant_key, p_account_id)` hace los hasta dos upserts internamente, en un round trip. Toma el `user_id` de `auth.uid()`, nunca de parámetro, igual que `bump_category_learning`. `SECURITY DEFINER`, `search_path = ''`, `GRANT EXECUTE` a `authenticated` y `REVOKE` a `anon`.

Selección: se filtra por contexto, se scorea por `hit_count`, se desempata por `last_used_at` y se exige un mínimo de repeticiones antes de influir. Mismo criterio que `suggestLearnedCategory`.

### 6. Precedencia

`usuario > índice del modelo > puntaje con prior`, alineado con la convención ya vigente en el repo para categorías (`regla explícita > aprendido > IA`, `movement-form.tsx:351` vs `:367`). Si el usuario ya tocó el campo, no se pisa: se reusa el mecanismo de guarda que ya existe (`userSetCategory.current`).

## Risks / Trade-offs

- **El cambio de schema de `extract-movement` es el punto sensible** → se mantiene el campo `cuenta` string como fallback, el índice se valida contra el rango real, y ante cualquier inconsistencia se degrada a "no resuelto" en vez de romper la carga. Los tests cubren índice fuera de rango, índice ausente y string sin índice.

- **Los umbrales (`0.45`, `0.15`, `+0.20`) son juicio, no medición** → quedan como constantes exportadas y testeadas con los casos reales del repo. Si en uso resultan mal calibrados, se mueve un número, no la lógica.

- **El prior puede afianzar un error**: si el usuario confirmó varias veces un movimiento en la cuenta equivocada, el sistema aprende ese error → acotado porque el prior solo desempata (nunca resuelve solo, decisión 3) y exige un mínimo de repeticiones. El usuario siempre puede corregir el campo antes de confirmar, y esa corrección alimenta el aprendizaje en sentido contrario.

- **Reemplazar cuatro matchers toca superficie amplia** (form, chat, tools del chat, import de resumen) → el resolver se introduce con sus tests primero y recién después se migran los llamadores; cada uno mantiene su comportamiento observable salvo los cambios que el spec pide explícitamente.

- **Costo de un round trip extra por movimiento guardado** (el RPC de aprendizaje) → es fire-and-forget, no bloquea el guardado y nunca lanza, igual que `recordCategoryLearning`.

- **Más tokens por request** al mandar tipo y moneda de hasta 100 cuentas → marginal frente al resto del prompt, y se compensa con menos reintentos por cuenta mal detectada.

## Migration Plan

1. Migración `0058_account_learning.sql`: tabla, índice, RLS con las cuatro policies `auth.uid() = user_id`, RPC `bump_account_learning` con sus `GRANT`/`REVOKE`. Aditiva: no toca tablas existentes.
2. Utilidad de normalización + resolver + tests, sin llamadores todavía.
3. Migración de los llamadores al resolver, uno por uno.
4. Cambio de contrato de `extract-movement` (índice + metadata), con el fallback por nombre activo.
5. Escritura y lectura del aprendizaje.

Rollback: los pasos 2–5 son revertibles por código. La migración es aditiva; si hiciera falta, se descarta dejando la tabla huérfana sin impacto en el resto de la app.

## Open Questions

- **`import-statement` extrae un `account_hint` que hoy se descarta** (`statement-schema.ts:42`, sin ningún consumidor). Al tocar ese flujo hay que decidir: conectarlo al resolver como sugerencia de tarjeta, o quitarlo del schema. Conectarlo es lo coherente con este cambio; quitarlo es lo honesto si no se va a usar. Queda para resolver en implementación, con default a conectarlo.
- Los umbrales quedan calibrados contra los casos conocidos del repo. Vale revisarlos después de uso real con cuentas de nombres largos.
