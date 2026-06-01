## Context

Movimientos vive en `src/components/movements/movements-list.tsx` (1491 líneas): hoy filtra del lado del cliente sobre `fetchMovements`/`fetchTransfers` (limit 100), con un `FiltersPanel` detrás de un toggle (cuenta single, categoría single, inputs `<input type=date>` nativos, búsqueda en nota), y un contenedor `max-w-3xl`. Analytics ya tiene una barra de filtros madura en `src/components/stats/stats-filter-bar.tsx` con presets de fecha, multi-select por DropdownMenu+checkbox, y guardar/cargar/borrar vistas sobre la tabla `saved_views` (payload jsonb `{dateFrom, dateTo, categoryIds, accountIds, currency, type}`). `MangoSelect` es single-select con `showSearch` + `leading` (íconos). `AccountIconChip`/`renderAccountIcon` ya resuelven emoji/URL/lucide; las categorías no tienen helper de ícono aún.

Decisiones de producto ya tomadas: vistas propias de Movimientos (scope), barra colapsable en mobile / expandida en desktop, búsqueda sobre nota + categoría + cuenta.

## Goals / Non-Goals

**Goals:**
- Componente `DateRangeFilter` reutilizable (operador + presets + últimos N + calendario) que emita `{from, to}` normalizado + label.
- `MangoMultiSelect` con buscador e íconos.
- Barra de filtros siempre visible, full-width desktop, compacta/colapsable en mobile.
- Filtrado server-side de movimientos y transferencias.
- Vistas guardadas con nombre, propias de Movimientos (`scope`).

**Non-Goals:**
- Reescribir Analytics (solo se le agrega el filtro `scope='stats'` a su lectura de vistas).
- Modos de visualización (tabla vs lista): "vistas" = filtros guardados, no layouts.
- Paginación infinita compleja: se mantiene un límite con "cargar más" si hace falta (ver D5).

## Decisions

### D1 — `DateRangeFilter` como componente nuevo y reutilizable
Componente controlado `value: DateRangeValue` + `onChange`. `DateRangeValue` guarda lo necesario para reconstruir la UI y para querysear:
`{ operator: 'is'|'before'|'after'|'between', preset?: PresetKey, lastN?: {n, unit}, date?: string, from: string|null, to: string|null, label: string }`.
- El componente computa siempre `from`/`to` normalizados (lo que consume la query) además de conservar el modo elegido para mostrar la UI y la etiqueta.
- Presets y "últimos N" se calculan con helpers en `src/lib/date-ranges.ts` (extraídos/generalizados de la lógica de presets de `stats-filter-bar`), reutilizables por Analytics más adelante.
- El calendario reutiliza `react-day-picker` (como `MangoDatePicker`); soporta selección de día único y de rango según el operador. Popover porteado a `document.body` (mismo patrón que `MangoDatePicker`) para no ser recortado por contenedores con scroll.
- Confirmación diferida (Aplicar/Cancelar): estado interno borrador, se emite `onChange` solo al Aplicar.
- Alternativa descartada: extender `MangoDatePicker` — su API es de fecha única; el rango+operador merece componente propio.

### D2 — `MangoMultiSelect` nuevo (no romper `MangoSelect`)
Componente paralelo `value: string[]` + `onChange(string[])`, con `showSearch`, `leading` por opción, chips/contador en el trigger y "Limpiar". Reutiliza la accesibilidad/teclado y el posicionamiento de `MangoSelect`.
- Para cuentas: `leading = AccountIconChip(icon)`. Para categorías: nuevo `CategoryIconChip`/`renderCategoryIcon` (sigue el patrón de `accounts.ts`; las categorías solo tienen emoji/texto hoy, pero se deja tolerante a URL por las dudas).
- Alternativa descartada: el patrón DropdownMenu+checkbox de stats — funciona pero no tiene buscador ni el render de íconos pedido; unificamos en un input multi-select propio.

### D3 — Estado de filtros + URL + vistas
Tipo unificado `MovementsFilter`:
`{ search: string, type: 'all'|'income'|'expense'|'transfer', date: DateRangeValue, accountIds: string[], categoryIds: string[] }`.
- Fuente de verdad en estado del componente (no solo URL) porque `DateRangeValue` y los arrays no entran cómodos en searchParams. Se puede reflejar un subconjunto en la URL para deep-linking, pero la persistencia "real" es vía vistas guardadas.
- Una vista guardada serializa `MovementsFilter` a `saved_views.filters` (jsonb). Cargar una vista = setear el estado de filtros.
- Compatibilidad con el payload de Analytics: el de Movimientos agrega `search`, `type='transfer'` y `date` con operador; conviven en la misma columna jsonb porque cada scope interpreta su propio shape.

### D4 — Filtrado server-side
`fetchMovements(filter)` y `fetchTransfers(filter)` construyen la query en Supabase:
- fecha: `.gte('date', from)` / `.lte('date', to)` cuando no son null.
- tipo: `income`/`expense` → `.eq('type', ...)` sobre movements y se omiten transfers; `transfer` → solo transfers; `all` → ambos.
- cuentas (movements): `.in('account_id', accountIds)`. (transfers): `.or('from_account_id.in.(...),to_account_id.in.(...)')`.
- categorías (movements): `.in('category_id', categoryIds)`; si hay categorías seleccionadas, se excluyen transfers.
- búsqueda: se resuelven IDs de cuentas/categorías cuyo nombre matchea (desde las listas ya cargadas en el cliente) y se arma `.or('note.ilike.%q%,account_id.in.(matchAcc),category_id.in.(matchCat)')` para movements; para transfers `note.ilike` + match por cuentas origen/destino.
- Se mantiene `order by date desc, created_at desc`.
- Alternativa descartada: seguir client-side — rompe las vistas de períodos viejos (limit 100).

### D5 — Paginación
Server-side con `limit` (ej. 200) + botón "Cargar más" (range/offset) si el resultado lo alcanza. Si resulta excesivo para el alcance inicial, se documenta el límite con un aviso ("mostrando los primeros N") en vez de truncar en silencio.

### D6 — Migración `scope` en `saved_views`
Nueva migración: `ALTER TABLE saved_views ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'stats'` + `CHECK (scope IN ('stats','movements'))`. Las filas existentes (de Analytics) quedan en `'stats'`. Lecturas de vistas filtran por scope. Actualizar `database.types.ts`. Se aplica en local y prod (vía el flujo de migración de la sesión).

### D7 — Layout y mobile
- Contenedor de la lista pasa de `max-w-3xl` a full-width (`w-full`, sin cap, dentro del `max-w-7xl` del layout). Grilla de filtros multi-columna en desktop.
- Mobile: una fila compacta (buscador + chips de filtros activos + botón "Filtros"); el resto despliega en un panel/sheet. Reutiliza `MangoSheet` o un disclosure simple.

## Risks / Trade-offs

- [Búsqueda por nombre de cuenta/categoría server-side es indirecta (FK)] → Se resuelven los IDs en el cliente desde las listas ya cargadas y se arma un `.or(... in ...)`; simple y suficiente para el volumen esperado.
- [`.or()` de Supabase con `in.()` puede volverse frágil si los arrays son grandes] → Acotar; el set de cuentas/categorías por usuario es chico.
- [Filtros en estado (no todo en URL) reducen deep-linking] → Aceptado; la persistencia se cubre con vistas guardadas.
- [Convivencia de shapes en `saved_views.filters`] → Cada scope lee su propio shape; el `scope` evita mezclar.
- [Cambiar `fetchMovements`/`fetchTransfers` afecta a quien las use] → Revisar todos los call sites; default sin filtro = comportamiento equivalente al actual.

## Migration Plan

1. Migración `scope` en `saved_views` (local + prod), actualizar tipos.
2. Helpers de rango (`date-ranges.ts`) + `DateRangeFilter` + `MangoMultiSelect` + `CategoryIconChip` (componentes aislados, sin tocar la lista todavía).
3. Refactor de data layer a server-side (`fetchMovements`/`fetchTransfers` con filtro).
4. Rearmar la barra de filtros + layout + búsqueda + vistas en `movements-list.tsx`.
5. Filtrar las vistas de Analytics por `scope='stats'`.
- Rollback: revertir migración (drop column) y los componentes nuevos son aditivos; `movements-list` se revierte por git.

## Open Questions

- ¿"Cargar más" explícito o subir el límite a un número alto fijo? Default propuesto: límite alto + "cargar más" si se alcanza.
