## Why

La sección de Movimientos desaprovecha el ancho en desktop, esconde los filtros tras un toggle, usa inputs de fecha nativos y selectores de una sola cuenta/categoría, y filtra del lado del cliente sobre los últimos 100 registros. Eso hace incómodo encontrar movimientos y vuelve imposible guardar combinaciones de filtros para reutilizarlas (una vista "El año pasado" hoy quedaría limitada a los 100 más recientes).

## What Changes

- **Layout full-width en desktop**: la lista de movimientos aprovecha todo el ancho disponible (hoy limitada a `max-w-3xl`).
- **Buscador**: campo de búsqueda que matchea nota/descripción, nombre de categoría y nombre de cuenta.
- **Barra de filtros siempre visible**: deja de estar detrás de un toggle. En desktop expandida; en mobile una fila compacta (buscador + chips de filtros activos) que despliega el resto.
- **Filtro de fecha por rango (componente nuevo y reutilizable)**: operador (`es` / `es antes de` / `es después de` / `está entre`), presets (Este mes, El mes pasado, Este trimestre, El trimestre pasado, Lo que va del año, El año pasado, Todo el historial), "Últimos N días/semanas/meses", y calendario para fechas/rango específicos. Se construye como componente independiente y se deja usable en otras secciones.
- **Selectores de cuenta y categoría multi-select con íconos**: nuevo `MangoMultiSelect` (con buscador y renderizado de logos/emojis/lucide), permitiendo elegir más de una cuenta y más de una categoría.
- **Filtrado server-side**: la query de movimientos/transferencias filtra en Supabase por rango de fecha, tipo, cuentas, categorías y búsqueda, en vez de traer 100 y filtrar en el cliente. **BREAKING** para `fetchMovements`/`fetchTransfers` (pasan a recibir el filtro).
- **Vistas guardadas con nombre (propias de Movimientos)**: guardar el conjunto de filtros como una vista con nombre; al entrar a la vista se ve ya filtrado. Se separan de las vistas de Analytics con una columna `scope` en `saved_views`.

## Capabilities

### New Capabilities
- `date-range-filter`: componente reutilizable de filtro de fecha por rango (operador + presets + últimos N + calendario) que produce un rango normalizado `{from, to}` y una etiqueta legible.
- `movements-filtering`: barra de filtros de Movimientos siempre visible (colapsable en mobile) con buscador, tipo, fecha (vía `date-range-filter`), multi-cuenta y multi-categoría con íconos, aplicada server-side, sobre un layout full-width en desktop.
- `movements-saved-views`: guardar/cargar/borrar vistas con nombre propias de Movimientos, persistidas en `saved_views` con `scope = 'movements'`.

### Modified Capabilities
<!-- No hay specs previos en openspec/specs/. -->

## Impact

- **Frontend**: `src/components/movements/movements-list.tsx` (layout, barra de filtros, búsqueda, vistas), nuevo `src/components/ui/date-range-filter.tsx`, nuevo `src/components/ui/mango-multi-select.tsx`, nuevo helper `renderCategoryIcon`/`CategoryIconChip`. Reutiliza `MangoDatePicker`/calendario, `AccountIconChip`, `renderAccountIcon`, el patrón de vistas de `stats-filter-bar.tsx`.
- **Data layer**: `fetchMovements`/`fetchTransfers` (`src/lib/movements.ts` + uso en la lista) pasan a filtrar server-side; helpers de saved views para movements; helpers de rango de fecha (presets) extraídos a `src/lib` para reuso.
- **Base de datos**: migración nueva que agrega `scope text NOT NULL DEFAULT 'stats'` (o equivalente) a `saved_views`, marcando las existentes como `stats`; las nuevas de movimientos usan `'movements'`. Tipos en `src/lib/database.types.ts`.
- **Compatibilidad**: el `stats-filter-bar` sigue funcionando; sus vistas quedan con `scope='stats'` y se filtran por ese scope.
