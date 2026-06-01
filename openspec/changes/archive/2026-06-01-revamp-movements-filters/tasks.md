## 1. Base de datos: scope en saved_views

- [x] 1.1 Migración nueva `supabase/migrations/0021_saved_views_scope.sql`: `ALTER TABLE saved_views ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'stats'` + `CHECK (scope IN ('stats','movements'))`; índice opcional `(user_id, scope)`
- [x] 1.2 Actualizar `src/lib/database.types.ts` con la columna `scope` en `saved_views`
- [x] 1.3 Hacer que la lectura de vistas de Analytics (`stats-filter-bar.tsx`) filtre por `scope = 'stats'` y guarde con ese scope

## 2. Helpers y componentes reutilizables (aislados)

- [x] 2.1 `src/lib/date-ranges.ts`: helpers de presets (este mes, mes pasado, este trimestre, trimestre pasado, lo que va del año, año pasado, todo el historial) y "últimos N (días/semanas/meses)" → devuelven `{from, to}` y label. Reutilizar/generalizar la lógica de presets de `stats-filter-bar`
- [x] 2.2 `src/components/ui/date-range-filter.tsx`: componente controlado (operador es/antes/después/entre + presets + últimos N + calendario react-day-picker con día único y rango), confirmación diferida (Aplicar/Cancelar), popover porteado a body. Emite `DateRangeValue` con `{from,to,label,...}`
- [x] 2.3 `src/components/ui/mango-multi-select.tsx`: multi-select (`value: string[]`) con `showSearch`, `leading` por opción, chips/contador en el trigger y "Limpiar"; reutiliza teclado/posicionamiento de MangoSelect
- [x] 2.4 `renderCategoryIcon`/`CategoryIconChip` (en `src/lib/categories.ts` o donde corresponda) siguiendo el patrón de `accounts.ts`

## 3. Data layer server-side

- [x] 3.1 Definir el tipo `MovementsFilter` (search, type, date `DateRangeValue`, accountIds[], categoryIds[]) en `src/lib/movements.ts`
- [x] 3.2 `fetchMovements(filter)`: construir la query Supabase (fecha gte/lte, type eq, account_id in, category_id in, búsqueda `.or` nota/cuenta/categoría); mantener orden y límite
- [x] 3.3 `fetchTransfers(filter)`: query con fecha, cuentas por origen/destino (`.or`), búsqueda por nota/cuenta; excluir cuando type=income/expense o cuando hay categorías seleccionadas
- [x] 3.4 Revisar y actualizar todos los call sites de `fetchMovements`/`fetchTransfers` (default sin filtro ≈ comportamiento actual)

## 4. Barra de filtros, layout y vistas en Movimientos

- [x] 4.1 Layout full-width: cambiar `max-w-3xl` a ancho completo y grilla de filtros multi-columna en desktop
- [x] 4.2 Barra de filtros siempre visible (quitar el toggle); buscador (nota+categoría+cuenta), tipo, `DateRangeFilter`, multi-cuenta y multi-categoría con íconos
- [x] 4.3 Mobile: fila compacta (buscador + chips de filtros activos + botón Filtros) que despliega el resto (sheet/disclosure)
- [x] 4.4 Conectar la barra al estado `MovementsFilter` y a las queries (react-query keys incluyen el filtro)
- [x] 4.5 Vistas guardadas de Movimientos: guardar/cargar/borrar con `scope='movements'` (reutilizar el patrón de `stats-filter-bar`); al cargar una vista, setear el filtro y ver la lista filtrada
- [x] 4.6 Paginación: límite alto + "cargar más" si se alcanza (o aviso de truncado)

## 5. Verificación

- [ ] 5.1 Aplicar migración `0021` en local; verificar que las vistas viejas quedan `scope='stats'` y solo aparecen en Analytics
- [ ] 5.2 Probar a mano: ancho desktop, buscador (nota/categoría/cuenta), cada operador y preset de fecha, multi-cuenta/multi-categoría con íconos, tipo transferencia, barra compacta en mobile, guardar/cargar/borrar vista
- [ ] 5.3 Verificar que un rango de un período viejo trae resultados (server-side, no limitado a los últimos 100)
- [ ] 5.4 Verificar que Analytics sigue funcionando con sus vistas
- [ ] 5.5 `npx tsc --noEmit` y lint de los archivos tocados
