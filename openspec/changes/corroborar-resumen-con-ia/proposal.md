## Why

Después de cargar un resumen de tarjeta (a mano o por import), el usuario no tiene forma rápida de verificar que esté COMPLETO contra el PDF real antes de pagarlo. Si el total no cuadra, hoy tiene que revisar línea por línea a ojo. Esta feature resuelve el "momento de pagar con confianza": subís el PDF de ese resumen y la IA te dice exactamente qué falta, qué sobra y qué no coincide, y agregás lo faltante con un click (incluidas las proyecciones de cuotas futuras).

## What Changes

- Nueva acción **"Corroborar con IA"** en un resumen puntual de la vista Tarjetas: subir el PDF de ESE resumen (≤15MB) y extraerlo con IA (reusa `extractStatement`; cuenta 1 uso del límite diario de IA).
- El sistema **compara** las líneas del PDF contra los movimientos ya cargados en ese ciclo y produce un **diff**: FALTA (en el PDF, no cargado), SOBRA (cargado, no en el PDF), y DIFERENCIA DE MONTO (matchea por comercio, distinto importe). El matching reusa el comercio normalizado (`normalizeNote`/`purchase_key`).
- **Pantalla de revisión del diff** (MangoSheet, estilo del import): el usuario elige qué **agregar** de lo que falta. Si una línea faltante es una cuota, se agregan también sus **proyecciones futuras** (misma proyección del import: `close_date` + tabla "Cuotas a vencer").
- Lo que **sobra** se **marca/lista** para que el usuario decida — **NO se borra automáticamente** (decisión de producto).
- **Aplicar** lo elegido da de alta los movimientos faltantes (y proyecciones) de forma **idempotente/reconciliable** con lo existente (reusa el mecanismo del import; no duplica lo ya cargado).
- Alcance: el diff es del **resumen puntual** (su ciclo), no de toda la tarjeta.

## Capabilities

### New Capabilities

- `card-statement-reconcile`: corroborar un resumen ya cargado contra su PDF con IA — subir el PDF del resumen, extraerlo, diff (falta/sobra/diferencia de monto) por comercio+monto+cuota contra los movimientos del ciclo, revisión con aplicación selectiva de lo faltante (+ proyección de cuotas), y marcado (sin borrar) de lo que sobra.

### Modified Capabilities

<!-- Reusa la extracción, el matching y la proyección de `card-statement-import` sin cambiar SUS requisitos (subir→revisar→confirmar, idempotencia, proyección). No hay delta para card-statement-import: esta capability nueva es consumidora de esas piezas. -->

## Impact

- **IA / extracción**: reusa `src/lib/ai/extract-statement.ts` + `statement-schema.ts` + ruta `POST /api/ai/import-statement` (misma extracción; sin cambios, o mínimos si el diff necesita algún dato extra).
- **Lógica de diff (nueva, pura)**: comparar `ParsedStatement` (del PDF) contra los movimientos cargados del ciclo → estructura de diff (falta/sobra/diferencia). Reusa `normalizeNote`/`purchase_key` de `statement-import.ts`/`rules.ts` para el matching. Probablemente en `src/lib/statement-import.ts` o un módulo nuevo `statement-reconcile.ts`.
- **UI**: nueva pantalla/MangoSheet de "Corroborar" (diff + aplicar selectivo), disparada desde `src/components/cards/cards-list.tsx` en un resumen puntual. Reusa componentes del import (`import-statement-flow`) donde aplique.
- **Persistencia**: reusa la RPC `import_card_statement` (idempotente/reconciliable) para dar de alta lo faltante sin duplicar; o un subconjunto de su payload. Sin migración nueva salvo que el diff requiera algo (a evaluar en diseño).
- **Restricciones**: español rioplatense; `numeric(18,2)`; timezone AR; nada automático sin confirmación; toda mutación reconciliable.
