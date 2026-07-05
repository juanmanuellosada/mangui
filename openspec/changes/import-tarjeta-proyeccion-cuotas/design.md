## Context

El importador de resumen en PDF (commit `376be84`, migración 0049) hoy carga cada línea como un **movimiento simple** del ciclo leído, con "(cuota N/T)" en la nota, y **no proyecta cuotas futuras**. Esa decisión fue deliberada para no inventar cuotas ni duplicar al importar meses siguientes.

Al mismo tiempo, la app **ya modela las compras en cuotas como `installment_purchases`** con toda su maquinaria (spec `credit-card-statements`): los resúmenes se autocalculan en vivo desde los movimientos del ciclo, la navegación abarca ciclos futuros que contienen cuotas, y hay detalle de cuotas con postergación en cascada y edición con recálculo. Es decir, la infraestructura para "cuotas que caen en resúmenes futuros" ya existe y funciona; el importador simplemente no la usaba.

El usuario pidió invertir esa decisión: un import debe dejar cargadas también las cuotas futuras, mostrarlas agrupadas por resumen para aprobar, propagar correcciones y sugerir suscripciones como recurrentes. Decisiones de producto ya tomadas: **reconciliar por compra** (anti-duplicado) y **sugerir suscripción con toggle** (nada automático).

## Goals / Non-Goals

**Goals:**

- Un solo import deja cargadas las cuotas futuras de cada compra en cuotas, montadas sobre `installment_purchases` (no un mecanismo paralelo).
- Preview agrupada por resumen (ciclo leído + ciclos futuros) con aprobación por resumen y propagación de correcciones a las cuotas futuras de la misma compra.
- Reconciliación idempotente por identidad de compra: reimportar meses siguientes actualiza en vez de duplicar.
- Clasificación de líneas (cuota / suscripción / gasto simple) y sugerencia de recurrente con confirmación explícita.
- Mantener transacción atómica única y la idempotencia por resumen ya existentes.

**Non-Goals:**

- No se rediseña la maquinaria de cuotas existente (detalle, cascada, edición) — el import se vuelve productor de esas cuotas, nada más.
- No se resuelve la proyección de **cuotas en USD** con FX futuro desconocido (caso borde; en la práctica lo USD son suscripciones). Se mantiene el manejo USD actual por línea.
- No se cambia el modelo de resúmenes virtuales autocalculados (no se persisten filas de `card_statements` para ciclos futuros salvo lo que ya hace el pago).

## Decisions

### D1 — Reconstruir `installment_purchases` en vez de movimientos sueltos

Cada línea de cuota se reconstruye como una compra en cuotas real. Rationale: la app ya genera y muestra las cuotas futuras desde `installment_purchases`; reconstruirlas da la proyección "gratis" y reusa detalle/cascada/edición. La objeción original (evitar inventar fecha/monto y `chk_installment_fields` que exige los 3 campos) queda salvada porque el PDF aporta monto por cuota, N/T y permite derivar fecha de compra y monto total.

- **Alternativa descartada**: proyección paralela con movimientos "previstos" en un estado nuevo. Más superficie de UI y un segundo modelo de cuotas que divergiría del existente.

### D2 — Identidad de compra para reconciliación

Se agrega a la compra en cuotas (y/o a sus movimientos) una **clave de identidad de compra** estable derivada de: comercio normalizado + fecha de compra + total de cuotas. La reconciliación al importar un resumen posterior matchea `(purchase_key, cuota_n)`: si existe, actualiza; si no, crea. Rationale: `installment_purchases` ya ES la identidad natural de una compra; solo falta una clave determinística para reencontrarla entre imports. Reusa el patrón de idempotencia por `import_statement_id`.

- **Alternativa descartada**: matchear por monto+fecha aproximados sin clave persistida (frágil ante reparse de Gemini).

### D3 — Fechas/períodos de cuotas proyectadas

Se derivan del ciclo de facturación del resumen leído (cierre/vencimiento, helpers de `src/lib/cards.ts`) más el offset del número de cuota, un mes por ciclo. Se mantiene el espaciado mensual coherente con la postergación en cascada existente.

### D4 — Preview agrupada y `buildStatementPayload` puro

La agrupación por resumen, la proyección de cuotas y la propagación de correcciones se resuelven en la capa pura `buildStatementPayload` (ya testeada), que produce el payload agrupado por ciclo. La RPC atómica `import_card_statement` recibe ese payload y hace, en una transacción: upsert de `installment_purchases` por identidad de compra, (re)generación/reconciliación de las cuotas, alta de gastos simples, y —si el toggle está activo— la recurrente. Rationale: mantener la lógica determinística en TS testeable y la atomicidad en la RPC.

### D5 — Suscripción → recurrente con confirmación

La IA marca `is_subscription`; la preview expone el toggle; el payload incluye la intención solo si el usuario confirmó. La RPC crea la recurrente en la misma transacción. Respeta la regla dura (nada automático).

## Risks / Trade-offs

- **[Reconciliación incorrecta duplica o pisa cuotas]** → Clave de identidad determinística + match por `(purchase_key, cuota_n)`; tests de reconciliación (proyectar 1/6, luego importar el resumen con 2/6 real → 0 duplicados) antes de tocar prod.
- **[Gemini reparsea distinto el comercio entre meses y rompe el match]** → Normalización del comercio (misma `normalizeNote`/`extractKeyword` de rules.ts) al derivar `purchase_key`; la preview permite corregir antes de guardar.
- **[Cuota fija asumida no coincide con cuotas reales variables (interés/USD)]** → Chequeo de suma contra la tabla "cuotas a vencer" del PDF; la reconciliación actualiza con el monto real cuando llega el resumen; USD-en-cuotas queda como non-goal.
- **[Proyectar a un ciclo ya pagado]** → No proyectar/actualizar cuotas que caigan en un resumen `pagado` (consistente con la regla existente de cascada que no toca resúmenes pagados).
- **[Volumen de cuotas proyectadas infla la preview]** → Agrupación por resumen y aprobación por resumen mitigan la carga cognitiva.

## Migration Plan

1. Migración SQL nueva: columnas de identidad de compra (p. ej. `purchase_key` y refuerzo de `installment_n`/`installment_total`) e índice único para reconciliación; sin backfill obligatorio (compras previas siguen válidas, solo no reconciliables retroactivamente).
2. Ajustar la RPC `import_card_statement` para upsert por identidad + reconciliación, manteniendo `SECURITY DEFINER`, `GRANT authenticated` y atomicidad.
3. Extender extractor IA + schema (clasificación y N/T) y `buildStatementPayload` (proyección/agrupación/propagación), con tests puros.
4. Actualizar la UI de revisión (grupos por resumen, aprobación, toggle suscripción).
5. Rollback: la migración es aditiva; se puede desactivar la proyección en `buildStatementPayload` (feature-flag/branch) volviendo al comportamiento de movimiento simple sin tocar datos.

## Resolved

- **Periodicidad de la recurrente sugerida = mensual.** Una suscripción se repite una vez por resumen (mensual), así que la recurrente creada desde el toggle asume periodicidad mensual y hereda categoría/monto/moneda de la línea detectada.

## Open Questions

- ¿La identidad de compra vive en `installment_purchases` (una fila por compra) o también se materializa en cada `movements` para el match directo? (definir en tasks/implementación según el shape actual de la RPC).
