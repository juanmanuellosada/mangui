## Why

La sección de Metas quedó desalineada con el resto de la app: su modal usa controles propios en vez de los componentes compartidos (selector de moneda, monto, cuenta/categoría, fecha), su lista no tiene los filtros ni el borrado múltiple que ya existen en Presupuestos y Cuentas, y su modelo de datos solo contempla dos tipos (`saving`, `reduction`) con un único alcance de cuenta/categoría. Unificar los tres tipos de meta bajo un mismo modelo y reutilizar los componentes existentes mejora la coherencia de la UX y simplifica el mantenimiento.

## What Changes

- **BREAKING (schema):** se agrega el tipo `income` al enum de metas y se reestructura la tabla `goals`:
  - Nuevas columnas comunes: `icon`, `is_global`, `period`, `start_date`, `end_date`, `recurring`.
  - El alcance pasa de un único `category_id`/`account_id` a **multi** cuenta y multi categoría (tablas de relación).
  - Historial por período para recurrencia (renovar + archivar) reutilizando/extendiendo `goal_snapshots`.
  - Migración de las metas `saving`/`reduction` existentes al nuevo modelo.
- **Tres tipos unificados** con los mismos campos comunes (nombre, icono, moneda, período preset/personalizado con fecha inicio–fin, recurrencia, flag global, alcance):
  - `income`: mide Σ de ingresos del alcance hacia un monto objetivo.
  - `saving`: mide el **neto** del período (Σ ingresos − Σ gastos) hacia un monto objetivo.
  - `reduction`: el usuario elige una o varias categorías y un % de reducción; el baseline se calcula del historial o se ingresa manual, y el monto objetivo se autocalcula (`baseline × (1 − %/100)`).
- **Período**: presets (`weekly`, `biweekly`, `monthly`, `quarterly`, `annual`) o `custom`. Siempre se muestran fecha inicio y fecha fin; los presets las autocompletan; en custom el usuario las edita.
- **Flag global**: si está activo, la meta afecta a todas las cuentas y categorías y se ocultan los selectores de alcance; si no, aparecen los selectores multi.
- **Modal de meta** alineado al de Nuevo movimiento: reutiliza `CurrencySelect`, `MoneyInput`, `MangoSelect`/`MangoMultiSelect`, `MangoDatePicker` e `IconPicker` (catálogo de categorías) para el icono.
- **Lista de metas**:
  - Filtros con el patrón de `budgets-list.tsx` (búsqueda, pills de tipo/estado/moneda, multiselect de categorías/cuentas, control de orden).
  - Barra de progreso reutilizable coloreada según el % de avance, compartida por los tres tipos.
  - Borrado múltiple con `useMultiSelect` + `SelectionBar` + `RowCheckbox`.

## Capabilities

### New Capabilities
- `goals`: gestión de metas financieras (ingreso, ahorro, reducción) con campos comunes (nombre, icono, moneda, período, recurrencia, alcance global o multi cuenta/categoría), cálculo de progreso por tipo, y una lista con filtros, barra de progreso y borrado múltiple.

### Modified Capabilities
<!-- Ninguna: no existe spec previa de metas; las specs de movements/date-range no cambian sus requisitos. -->

## Impact

- **DB / Supabase:** nueva migración que altera `goals` (enum + columnas), crea tablas de relación de alcance (`goal_accounts`, `goal_categories`), y extiende el historial por período. Regenerar `src/lib/database.types.ts`.
- **Lógica:** `src/lib/goals.ts` (nuevos cómputos: income, saving=neto, reduction multi-categoría; lógica de período y renovación).
- **UI:** `src/components/goals/goals-list.tsx` y `goal-form.tsx` (reescritura del modal y la lista); nuevo componente de barra de progreso compartido.
- **Reutiliza (sin cambios):** `MoneyInput`, `CurrencySelect`, `MangoSelect`, `MangoMultiSelect`, `MangoDatePicker`, `IconPicker`, `useMultiSelect`, `SelectionBar`, `RowCheckbox`, y el patrón de filtros de `budgets-list.tsx`.
- **Datos existentes:** migración de metas actuales; sin pérdida de datos.
