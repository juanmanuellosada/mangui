## Context

La tabla `goals` (migración `0013_budgets_goals.sql`) modela hoy dos tipos (`saving`, `reduction`) con un único `category_id`/`account_id`, sin período, recurrencia, flag global ni icono. La lógica vive en `src/lib/goals.ts` (`computeSavingProgress`, `computeReductionProgress`, `suggestBaseline`, `monthlySeries`) y la UI en `src/components/goals/{goals-list,goal-form}.tsx`. La app ya cuenta con componentes compartidos maduros (`MoneyInput`, `CurrencySelect`, `MangoSelect`, `MangoMultiSelect`, `MangoDatePicker`, `IconPicker`, `useMultiSelect`, `SelectionBar`) y un patrón de filtros completo en `budgets-list.tsx`. Stack: Next.js 16 / React 19 / Tailwind v4 / shadcn / React Query v5 / Supabase con RLS; formularios con React Hook Form + Zod.

## Goals / Non-Goals

**Goals:**
- Un único modelo de datos y un único modal para los tres tipos (`income`, `saving`, `reduction`).
- Reutilizar al máximo los componentes existentes (cero controles nuevos salvo la barra de progreso compartida).
- Alcance multi cuenta/categoría con flag global.
- Período preset/custom con autocompletado de fechas y recurrencia con renovación + historial.
- Migrar las metas existentes sin pérdida de datos.

**Non-Goals:**
- No se rediseña Presupuestos ni Movimientos (solo se reutilizan sus componentes).
- No se construyen gráficos/sparklines nuevos por meta (queda para más adelante; `monthlySeries` se conserva).
- No se cambia el sistema de iconos ni el catálogo de categorías.

## Decisions

### D1 — Alcance multi vía tablas de relación (no arrays)
Crear `goal_accounts(goal_id, account_id)` y `goal_categories(goal_id, category_id)` con FKs y RLS, en lugar de columnas `uuid[]`. Rationale: integridad referencial (FK a cuentas/categorías), borrado en cascada, y joins simples para filtrar movimientos. Alternativa descartada: arrays `uuid[]` — más simples de escribir pero sin FK ni cascada y con queries más frágiles. Las columnas `category_id`/`account_id` actuales se migran a filas en estas tablas y luego se eliminan. `is_global = true` ⇒ sin filas de alcance.

### D2 — Período como (period_type, start_date, end_date) materializados
Guardar `period` (`weekly|biweekly|monthly|quarterly|annual|custom`) junto con `start_date` y `end_date` siempre persistidos. Rationale: el cómputo de progreso necesita un rango concreto y la recurrencia necesita el rango del período activo; materializar el fin evita recomputarlo en cada lectura y soporta `custom` de forma uniforme. El autocompletado del fin (al elegir preset) ocurre en el cliente (helper `periodEnd(start, preset)`), pero el valor final se persiste.

### D3 — Recurrencia con snapshots de período
Extender/reutilizar `goal_snapshots` para guardar el resultado de cada período cerrado (period_start, period_end, valor alcanzado, target, % , estado). Al vencer `end_date` de una meta `recurring`: insertar snapshot del período cerrado y avanzar `start_date`/`end_date` al siguiente período (reiniciando el progreso, que se deriva de los movimientos del nuevo rango). Rationale: el progreso vivo siempre se calcula de movimientos dentro de `[start_date, end_date]`; los snapshots solo guardan historial. La renovación se dispara de forma perezosa (al leer/listar metas se detecta el vencimiento y se renueva) para no depender de un cron; se deja la puerta abierta a un job server-side luego.

### D4 — Tipo unificado en una sola tabla con campos condicionales
Mantener una sola tabla `goals` con `type` y campos específicos nullables (`target_amount`, `target_percent`, `baseline_amount`). El constraint `chk_goal_target` se amplía: `income`/`saving` requieren `target_amount`; `reduction` requiere `target_percent` (y baseline calculado o `baseline_amount`). Rationale: los tres tipos comparten ~90% de los campos; STI (single-table inheritance) evita joins y duplicación. La UI muestra/oculta los campos extra por tipo usando los mismos componentes.

### D5 — Cómputo de progreso unificado en goals.ts
Reemplazar las dos funciones por un `computeGoalProgress(goal, movements, ref?)` que ramifica por tipo y devuelve una forma común `{ value, target, percent, status }` para alimentar una sola barra de progreso. `status` ∈ `on_track | near | reached | exceeded` mapea a colores. `suggestBaseline` se conserva y se generaliza a multi-categoría. El alcance se aplica filtrando movimientos por `accountIds`/`categoryIds` (o todos si `is_global`).

### D6 — Modal y lista por composición, reutilizando lo existente
`goal-form.tsx` se reescribe componiendo `IconPicker` + `CurrencySelect` + `MoneyInput` + `MangoMultiSelect` (cuenta/categoría) + `MangoDatePicker` + un sub-bloque de período. El bloque de filtros de la lista se adapta del de `budgets-list.tsx` (mismas piezas, enums de metas). La barra de progreso inline se extrae a `src/components/ui/progress-bar.tsx` (o `goals/goal-progress-bar.tsx`) compartida por los tres tipos y, si conviene, también por presupuestos.

## Risks / Trade-offs

- **Migración de schema con datos vivos** → escribir la migración idempotente y en pasos (añadir columnas/tablas → backfill desde `category_id`/`account_id` → constraints → drop de columnas viejas); probar primero en branch de Supabase y regenerar `database.types.ts`.
- **Renovación perezosa puede dispararse en lecturas concurrentes** → hacer el insert de snapshot + avance de período idempotente (unique en `(goal_id, period_start)` para snapshots) para que dos lecturas simultáneas no dupliquen.
- **`saving` = neto puede dar progreso negativo** (gastos > ingresos) → la barra clampa a [0, 100] y muestra el neto real en el detalle; definir color para neto negativo.
- **Reescritura amplia de la UI de metas** → mantener los tests/comportamiento de `goals.ts` cubiertos y avanzar por capas (schema → lógica → modal → lista) para reducir el blast radius.
- **RLS en tablas nuevas** → replicar exactamente las políticas de `goals` (por `user_id` vía join) en `goal_accounts`/`goal_categories`.

## Migration Plan

1. Migración SQL: enum `+income`; columnas `icon`, `is_global`, `period`, `start_date`, `end_date`, `recurring`; tablas `goal_accounts`, `goal_categories` (con RLS); ampliar `goal_snapshots`; backfill de alcance desde columnas viejas y defaults de período para metas existentes; ampliar `chk_goal_target`; drop de `category_id`/`account_id`.
2. Regenerar `src/lib/database.types.ts`.
3. Refactor de `src/lib/goals.ts` (cómputo unificado + período + renovación).
4. Reescritura de `goal-form.tsx` (modal) y `goals-list.tsx` (filtros, barra, multiselección).
5. Verificación: metas existentes visibles y correctas; crear una meta de cada tipo; borrado múltiple; renovación de una meta recurrente vencida.

**Rollback:** la migración es la única parte difícil de revertir; conservar un script de down que restaure `category_id`/`account_id` desde las tablas de relación antes del drop, y no eliminar columnas viejas hasta verificar en staging.

## Resolved Decisions

- **Barra de progreso compartida:** se aplica **solo en Metas** en este cambio. Adoptarla en Presupuestos queda como follow-up posterior (preguntar al usuario al cerrar este cambio).
- **`saving` con neto negativo:** se muestra el **porcentaje negativo en rojo** (no se clampa a 0%). La longitud visual de la barra se clampa a 0 pero la etiqueta de % refleja el valor real y se colorea como `exceeded`/negativo.
- **Recurrencia:** **renovación perezosa** (al leer/listar) para la primera entrega; el job server-side queda como mejora futura.
