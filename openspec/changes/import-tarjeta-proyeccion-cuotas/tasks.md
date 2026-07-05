## 1. DB: identidad de compra y reconciliación

- [x] 1.1 Nueva migración SQL en `supabase/migrations/`: agregar clave de identidad de compra (p. ej. `purchase_key`) y asegurar `installment_n` / `installment_total` en `installment_purchases` (o la tabla que corresponda), con índice único que permita reconciliar `(user_id, purchase_key, installment_n)`.
- [x] 1.2 Migración aditiva sin backfill obligatorio; verificar que compras/cuotas existentes siguen válidas y que `chk_installment_fields` se cumple con los 3 campos.
- [x] 1.3 Ajustar la RPC `import_card_statement(p_payload jsonb)`: en una sola transacción, upsert de `installment_purchases` por identidad de compra, (re)generación/reconciliación de cuotas por `(purchase_key, installment_n)`, alta de gastos simples, y creación de recurrente si viene marcada. Mantener `SECURITY DEFINER`, `GRANT authenticated`, idempotencia por `import_statement_id` y no tocar cuotas de resúmenes `pagado`.
- [ ] 1.4 Aplicar la migración en el proyecto Supabase y verificar en un caso real (proyectar 1/6 → luego importar resumen con 2/6 real → 0 duplicados).

## 2. IA: extracción y clasificación

- [x] 2.1 Extender el prompt en `src/lib/ai/extract-statement.ts` para clasificar cada línea como `cuota` / `suscripcion` / `simple` y extraer `installment_n`, `installment_total`, fecha de compra y `is_subscription`, además de la categoría (nombre exacto de la lista del usuario o null).
- [x] 2.2 Extender el schema en `src/lib/ai/statement-schema.ts` con los campos nuevos por línea (Zod).
- [x] 2.3 Reforzar que las líneas de pago/saldo/devolución NO se devuelvan como consumos.

## 3. Lógica pura: proyección, agrupación y reconciliación

- [x] 3.1 En `src/lib/statement-import.ts`, extender `buildStatementPayload` (puro) para: derivar `purchase_key` (comercio normalizado con la misma `normalizeNote`/`extractKeyword` de `rules.ts` + fecha de compra + total de cuotas).
- [x] 3.2 Proyectar las cuotas faltantes (N+1…T) con monto = cuota leída y fecha/período derivados del ciclo del resumen (helpers de `src/lib/cards.ts`), un mes por ciclo.
- [x] 3.3 Agrupar el payload por resumen/ciclo (leído + futuros) para la preview y la aprobación por resumen.
- [x] 3.4 Implementar la propagación de correcciones: editar categoría/descr/monto/incluir de una compra en cuotas afecta a todas sus cuotas futuras proyectadas.
- [x] 3.5 Chequeo de suma opcional contra la tabla agregada "cuotas a vencer" del PDF (solo validación, no fuente de monto).
- [x] 3.6 Tests puros (Vitest): proyección 1/6 y 4/6, agrupación por ciclo, propagación de edición, y reconciliación (no duplicar 2/6 ya proyectada).

## 4. UI: preview agrupada por resumen

- [x] 4.1 En `src/components/cards/import-statement-flow.tsx`, cambiar la pantalla de revisión a preview agrupada por resumen (cada grupo con período y total).
- [x] 4.2 Aprobación resumen por resumen (no forzar aprobar todo de una).
- [x] 4.3 Edición de línea que propaga a cuotas futuras de la misma compra (reflejar en la UI antes de guardar).
- [x] 4.4 Toggle "crear como recurrente" en líneas marcadas como suscripción (por defecto desactivado).
- [x] 4.5 Mantener el pedido de cotización manual para líneas USD sin equivalente en pesos.

## 5. Recurrentes

- [x] 5.1 Integrar con el módulo `src/components/recurring/`: al confirmar con el toggle activo, crear la transacción recurrente (periodicidad mensual por defecto, heredando categoría/monto/moneda de la línea).

## 6. Verificación end-to-end

- [ ] 6.1 Importar un resumen real con cuotas → verificar que las cuotas futuras aparecen en los ciclos correctos (navegación de resúmenes) y en el detalle de cuotas existente.
- [ ] 6.2 Importar el resumen del mes siguiente → verificar reconciliación sin duplicados y actualización con montos reales.
- [ ] 6.3 Verificar suscripción → recurrente solo con confirmación; y que nada se guarda si el usuario cierra sin confirmar.
- [x] 6.4 `npm run lint`, `npm run typecheck`, `npm test` en verde.
