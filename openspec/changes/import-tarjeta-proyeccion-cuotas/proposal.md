## Why

Hoy el importador de resumen en PDF carga cada línea como un movimiento simple del mes leído y no proyecta las cuotas futuras: si el resumen trae `Macowens 1/6`, el usuario tiene que reimportar cada mes o cargar las 5 cuotas restantes a mano. Además no distingue suscripciones de gastos comunes. El objetivo es que un solo import deje **todo listo hacia adelante** —cuotas futuras incluidas— y que las suscripciones se puedan volver recurrentes, todo bajo aprobación humana explícita.

## What Changes

- El extractor de IA pasa a identificar, por cada línea, si es **cuota** (con número y total, p. ej. `4/6`) o **suscripción** (cargo mensual recurrente no-cuota tipo Claude/Netflix/Spotify), además de la categoría.
- Para cada compra en cuotas, el importador **reconstruye una compra en cuotas (`installment_purchases`)** en vez de un movimiento suelto, de modo que las cuotas futuras faltantes queden proyectadas y montadas sobre la maquinaria de cuotas que la app ya tiene (navegación a ciclos futuros, detalle, postergación en cascada, recálculo). **BREAKING** respecto del comportamiento actual documentado en memoria (líneas de cuota como movimiento simple con "(cuota N/T)" en la nota).
- La pantalla de revisión pasa a mostrar la preview **agrupada resumen por resumen** (el ciclo leído + los ciclos futuros que reciben cuotas proyectadas), y el usuario **aprueba resumen por resumen**.
- Corregir una compra en la preview (categoría, monto, descripción, incluir/excluir) **se propaga a las cuotas futuras** proyectadas de esa misma compra antes de guardar.
- **Reconciliación por identidad de compra**: al importar un resumen posterior que trae una cuota ya proyectada, el sistema la reconoce (comercio + fecha de compra + total de cuotas + número de cuota) y la **actualiza con el dato real** en vez de duplicarla. Extiende la idempotencia por resumen ya existente.
- Las líneas marcadas como suscripción muestran en la preview un **toggle "crear como recurrente"**; la transacción recurrente se crea **solo si el usuario lo confirma** (nada automático).

## Capabilities

### New Capabilities

- `card-statement-import`: importación de resumen de tarjeta en PDF con IA — extracción, clasificación de líneas (cuota / suscripción / gasto simple), proyección y reconciliación de cuotas futuras, preview agrupada por resumen con aprobación y propagación de correcciones, y sugerencia de recurrentes. Captura como baseline el comportamiento vigente (subir → revisar → confirmar, idempotencia por resumen, manejo de líneas USD) y agrega la proyección/reconciliación/suscripciones.

### Modified Capabilities

<!-- La proyección monta sobre installment_purchases, que ya pertenecen a credit-card-statements; no cambian los REQUISITOS de esa capability (navegación, detalle, cascada, edición siguen igual), solo se convierte en consumidor de las cuotas que el import ahora crea. Sin delta para credit-card-statements. -->

## Impact

- **IA / extracción**: `src/lib/ai/extract-statement.ts` (prompt: clasificar línea como cuota/suscripción y extraer N/T y fecha de compra), `src/lib/ai/statement-schema.ts` (campos nuevos por línea).
- **Transporte / persistencia**: `src/lib/statement-import.ts` (`buildStatementPayload` puro: agrupar por resumen, proyectar cuotas futuras, propagar correcciones), ruta `POST /api/ai/import-statement`.
- **DB**: nueva migración en `supabase/migrations/` para la identidad de compra y la reconciliación; ajuste de la RPC atómica `import_card_statement` para reconstruir/upsertar `installment_purchases` y reconciliar por identidad de compra (manteniendo transacción única e idempotencia). Reusa `installment_purchases` y su `chk_installment_fields`.
- **UI**: `src/components/cards/import-statement-flow.tsx` (preview agrupada por resumen, aprobación por resumen, propagación de ediciones, toggle de suscripción), montado desde `cards-list.tsx`.
- **Recurrentes**: integración con el módulo `src/components/recurring/` para crear la recurrente sugerida al confirmar.
- **Restricciones**: español rioplatense; dinero `numeric(18,2)`; timezone AR (`todayAR`); nada automático sin confirmación; la preview nunca auto-guarda.
