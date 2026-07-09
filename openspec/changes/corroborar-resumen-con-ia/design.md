## Context

El importador de resúmenes ya extrae un PDF con IA (`extractStatement`), matchea por comercio normalizado (`purchase_key`/`normalizeNote`), proyecta cuotas (con la tabla "Cuotas a vencer") y persiste de forma idempotente/reconciliable (RPC `import_card_statement`, por `import_statement_id`, `(purchase_key, installment_number)`, `source_key`). Esta feature NO reinventa nada de eso: es un "modo corroborar/diff" que reusa la extracción y el matching, y agrega (a) el motor de diff entre el PDF y lo cargado, y (b) una UI de revisión con aplicación selectiva.

El resumen actual se muestra en `cards-list.tsx` vía `listCardCycles` (agrupa por `import_statement_id`, netea, proyecta recurrentes). Los movimientos del ciclo ya están disponibles ahí.

## Goals / Non-Goals

**Goals:**

- Corroborar un resumen puntual contra su PDF y mostrar un diff claro (falta / sobra / diferencia de monto).
- Agregar lo faltante de forma selectiva y reconciliable (sin duplicar), con proyección de cuotas.
- Reusar al máximo extracción, matching y proyección existentes.

**Non-Goals:**

- No borrar automáticamente lo que sobra (solo marcar).
- No corroborar toda la tarjeta de una (es por resumen/ciclo).
- No cambiar el flujo de import existente ni sus requisitos.
- No resolver diferencias de monto automáticamente (se muestran; el usuario decide).

## Decisions

### D1 — Motor de diff puro y testeable

Una función pura nueva (p. ej. `reconcileStatement(parsed, cycleMovements)` en `src/lib/statement-reconcile.ts`) que recibe el `ParsedStatement` del PDF y los movimientos del ciclo, y devuelve `{ missing: [...], extra: [...], mismatched: [...] }`. Matchea reusando `normalizeNote`/la derivación de `purchase_key` (mismo criterio que el import) + monto + número de cuota. Rationale: la lógica de comparación es determinística y debe testearse aislada; la UI solo la consume.

- **Alternativa descartada**: hacer el diff en el componente/UI → no testeable, se duplicaría el matching.

### D2 — Reusar la extracción y la persistencia del import

La extracción usa la misma ruta/`extractStatement` (sin cambios). La aplicación de lo faltante reusa la RPC `import_card_statement` con un payload que contiene SOLO las líneas/cuotas que el usuario tildó — la idempotencia por `import_statement_id`/`purchase_key` garantiza que no se dupliquen los movimientos ya cargados. Rationale: no crear un segundo camino de persistencia; la RPC ya reconcilia.

- Nota: hay que asegurar que aplicar un subconjunto NO borre lo demás. El import hoy borra los movimientos simples de ese `import_statement_id` antes de reinsertar. Para "corroborar" (agregar sobre lo existente sin un import previo con ese id) hay que decidir el vínculo con `import_statement_id`: opción A) el resumen corroborado ya tiene un `card_statements` con id → reusarlo y que la RPC reconcilie; opción B) un modo de la RPC/payload que solo hace UPSERT sin el DELETE previo. Definir en implementación (ver Open Questions).

### D3 — UI de diff como MangoSheet, estilo import

La pantalla de corroborar es un MangoSheet disparado desde el resumen en `cards-list.tsx`, con la misma estética que `import-statement-flow.tsx`: subir → diff → aplicar. Tres secciones (falta con checkboxes / diferencia de monto con ambos importes / sobra solo lectura). Reusa componentes de fila/badges del import.

### D4 — Matching y proyección compartidos

El matching (comercio normalizado + monto + cuota) y la proyección de cuotas (close_date + tabla "Cuotas a vencer") se reusan de `statement-import.ts` (extraer helpers si hace falta, sin romper el import). Rationale: coherencia total entre import y corroborar.

## Risks / Trade-offs

- **[El matching por comercio+monto marca falsos "falta"/"sobra"]** (mismo comercio con descripción distinta, ej. ANTHROPIC vs CLAUDE.AI) → reusar exactamente la normalización del import; mostrar el diff para que el humano confirme; tests con casos de descripción variable.
- **[Aplicar un subconjunto con la RPC borra/pisa lo existente]** → resolver el vínculo con `import_statement_id` (D2); tests de "agregar 1 faltante no toca los demás" antes de tocar prod.
- **[Diferencia de monto ambigua]** → solo se muestra (PDF vs cargado), no se auto-resuelve; el usuario decide editar.
- **[Doble fuente de verdad UI]** → el diff es puro (D1); la UI no recalcula.

## Migration Plan

1. `statement-reconcile.ts` puro + tests (diff engine).
2. Extraer/compartir helpers de matching y proyección desde `statement-import.ts` si hace falta (sin cambiar el import).
3. Definir y (si hace falta) ajustar el modo de aplicación reconciliable de lo faltante (RPC/payload) — con tests de no-duplicación y no-borrado.
4. UI de corroborar (MangoSheet) en `cards-list.tsx`.
5. Rollback: la feature es aditiva (un botón/flujo nuevo); no cambia el import ni datos existentes.

## Open Questions

- ¿La aplicación de lo faltante reusa la RPC `import_card_statement` tal cual (con su DELETE previo por `import_statement_id`) o hace falta un modo "solo upsert, sin borrar" para no pisar lo ya cargado? (definir en implementación según el shape actual de la RPC y si el resumen corroborado ya tiene `card_statements`).
- ¿Cómo se linkean los movimientos agregados por corroborar al resumen (mismo `import_statement_id` del resumen, o por ciclo/fecha)?
- ¿Las "diferencias de monto" ofrecen un "corregir al valor del PDF" (editar el movimiento) o solo se muestran? (MVP: solo mostrar).
