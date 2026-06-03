## 1. Schema y migración (Supabase)

- [x] 1.1 Crear migración que agrega `'income'` al enum de tipo de meta y las columnas `icon`, `is_global`, `period`, `start_date`, `end_date`, `recurring` a `goals` (con defaults válidos para filas existentes)
- [x] 1.2 Crear tablas `goal_accounts(goal_id, account_id)` y `goal_categories(goal_id, category_id)` con FKs y borrado en cascada
- [x] 1.3 Replicar las políticas RLS de `goals` (por `user_id`) en `goal_accounts` y `goal_categories`
- [x] 1.4 Backfill: migrar el `category_id`/`account_id` actual de cada meta a filas en las tablas de relación; setear período por defecto en metas existentes
- [x] 1.5 Ampliar `goal_snapshots` para historial por período (`period_start`, `period_end`, valor alcanzado, target, %, estado) con unique en `(goal_id, period_start)`
- [x] 1.6 Ampliar el constraint `chk_goal_target` para los tres tipos y eliminar las columnas `category_id`/`account_id` de `goals`
- [x] 1.7 Regenerar `src/lib/database.types.ts`

## 2. Lógica de dominio (src/lib/goals.ts)

- [x] 2.1 Definir el tipo `Goal` actualizado (tipos, campos comunes, alcance multi, período, recurrencia)
- [x] 2.2 Implementar helpers de período: `periodEnd(start, preset)` y validación de rango para `custom`
- [x] 2.3 Implementar `computeGoalProgress(goal, movements, ref?)` unificado que ramifica por tipo y devuelve `{ value, target, percent, status }` (status: on_track | near | reached | exceeded)
- [x] 2.4 Implementar el filtrado de movimientos por alcance (todas si `is_global`, o por `accountIds`/`categoryIds`)
- [x] 2.5 Generalizar `suggestBaseline` a multi-categoría y el autocálculo `target_amount = baseline × (1 − %/100)` para `reduction`
- [x] 2.6 Implementar la renovación perezosa: al leer/listar, detectar vencimiento de metas `recurring`, insertar snapshot del período cerrado y avanzar `start_date`/`end_date` (idempotente)

## 3. Componente de barra de progreso compartido

- [x] 3.1 Extraer el div inline actual a un componente `GoalProgressBar` (o `ui/progress-bar`) que recibe `percent` y `status` y aplica el coloreado, con `role="progressbar"` y aria

## 4. Modal de meta (goal-form.tsx)

- [x] 4.1 Reescribir el form componiendo `IconPicker` (catálogo categorías), `CurrencySelect`, `MoneyInput`, `MangoDatePicker` y el bloque de período
- [x] 4.2 Selector de tipo (ingreso/ahorro/reducción) que muestra/oculta los campos específicos usando los mismos componentes
- [x] 4.3 Bloque de período: select de preset + `MangoDatePicker` de inicio y fin, con autocompletado del fin al elegir preset y edición libre en `custom`
- [x] 4.4 Flag global con check: oculta los selectores de alcance cuando está activo; cuando no, muestra `MangoMultiSelect` de cuentas y categorías
- [x] 4.5 Campos de `reduction`: multiselect de categorías + % de reducción + baseline (botón "calcular de mi historial" o input manual) con monto objetivo autocalculado visible
- [x] 4.6 Validación Zod del nuevo modelo (nombre requerido, target por tipo, fin > inicio, alcance requerido si no es global)
- [x] 4.7 Mutaciones de create/update que persisten la meta y sincronizan las filas de `goal_accounts`/`goal_categories`

## 5. Lista de metas (goals-list.tsx)

- [x] 5.1 Adaptar el bloque de filtros de `budgets-list.tsx` a metas (búsqueda, tipo, estado, moneda, multiselect categorías/cuentas, control de orden)
- [x] 5.2 Implementar el orden (recientes, nombre, progreso, fecha de fin) y el filtrado en memoria
- [x] 5.3 Renderizar las cards de los tres tipos usando `GoalProgressBar` y mostrando icono, alcance/global y período
- [x] 5.4 Integrar borrado múltiple con `useMultiSelect` + `SelectionBar` + `RowCheckbox` + diálogo de confirmación y mutación de borrado en lote
- [x] 5.5 Cablear el modal de create/edit (incluye FAB en mobile) con el nuevo `goal-form.tsx`

## 6. Verificación

- [ ] 6.1 Verificar que las metas existentes (saving/reduction) se muestran y calculan correctamente tras la migración
- [ ] 6.2 Crear una meta de cada tipo (ingreso, ahorro, reducción), global y específica, y validar el progreso
- [ ] 6.3 Verificar autocompletado de fechas por preset y edición en `custom`
- [ ] 6.4 Verificar renovación de una meta recurrente vencida (snapshot creado + nuevo período)
- [ ] 6.5 Verificar borrado múltiple y filtros/orden de la lista
