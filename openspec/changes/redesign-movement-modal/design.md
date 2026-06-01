## Context

El modal "Nuevo movimiento" vive en `src/components/movements/movement-form.tsx` (formulario) montado dentro de `src/components/quick-add-provider.tsx` (wrapper `MangoSheet` + mutaciones inline de TanStack Query). Hoy el orden de campos es: tipo → monto → moneda → cuenta/categoría (grid 2 col) → cross-currency → nota → fecha (input nativo) + checkbox "Futuro". El formulario de transferencias ya existe (`src/components/transfers/transfer-form.tsx`) pero se abre como un modo separado del `QuickAddProvider` (`open("transfer")`), nunca desde el toggle del modal.

Estado actual relevante:
- `MangoSelect` (`src/components/ui/mango-select.tsx`) soporta `leading` (ícono) pero NO tiene buscador.
- El selector de categoría ya pinta su emoji vía `leading`; el de cuenta no pinta nada.
- `renderAccountIcon(icon, opts)` (`src/lib/accounts.ts`) ya resuelve emoji / URL (logo o imagen subida) / `lucide:`.
- `MangoDatePicker` (`src/components/ui/mango-date-picker.tsx`) ya se usa en `account-form.tsx` para la fecha de cierre de tarjeta.
- Storage ya se usa en `icon-picker.tsx` (bucket `icons`, ruta `{userId}/{uuid}.{ext}`, `getPublicUrl`).
- `is_future` hoy es un checkbox manual; `isInstallmentFuture(dateStr)` en `src/lib/installments.ts` ya implementa la derivación por fecha.
- No existe tabla ni bucket de adjuntos.

Constraint del proyecto: orquestación delega implementación al subagente `executor`; UI bespoke con tipografía/estilo propio (ver memoria del proyecto).

## Goals / Non-Goals

**Goals:**
- Eliminar combinaciones moneda/cuenta inválidas y el indicador redundante.
- Selector de cuenta con ícono y buscador en ambos selectores; layout en filas.
- Adjuntos (gasto: factura+recibo; ingreso: comprobante) al crear y editar, en Storage + tabla con RLS.
- Fecha como primer campo con `MangoDatePicker`; `is_future` derivado.
- Transferencias como tercer modo del mismo modal.

**Non-Goals:**
- Adjuntos en transferencias.
- Rediseño visual de otros modales (cuotas, AI).
- Migrar movimientos históricos: el `is_future` ya guardado no se recalcula retroactivamente.
- OCR / lectura automática de comprobantes.

## Decisions

### D1 — Moneda derivada de la cuenta salvo tarjeta de crédito
La moneda efectiva se decide en función de la cuenta seleccionada. Si `account.type !== 'tarjeta_credito'`, se setea `original_currency = account.currency` y se oculta `CurrencyToggle`. Si es tarjeta, se muestra el toggle y se conserva la sección cross-currency existente.
- Implementación: `useEffect`/handler sobre el cambio de `account_id` que fuerza `original_currency` cuando la cuenta no es tarjeta; el render del `CurrencyToggle` se condiciona a `account?.type === 'tarjeta_credito'`.
- Validación Zod: refinamiento que rechaza moneda ≠ moneda de cuenta cuando la cuenta no es tarjeta (defensa además del forzado de UI).
- Alternativa descartada: dejar el toggle siempre visible y validar al enviar — peor UX (muestra un control que el usuario no puede usar válidamente).

### D2 — Buscador en `MangoSelect` vía prop opt-in
Agregar `showSearch?: boolean` a `MangoSelect`: cuando es true, renderiza un input de filtro arriba de la lista y filtra `options` por `label` (case/acento-insensible). Mantiene el comportamiento actual por defecto (sin buscador) para no afectar otros usos.
- El selector de cuenta usa `leading: renderAccountIcon(a.icon, { size: 'h-4 w-4' })`.
- Alternativa descartada: combobox externo nuevo — duplicaría accesibilidad/teclado que `MangoSelect` ya tiene.

### D3 — Modelo de datos de adjuntos: tabla dedicada + bucket nuevo
Nueva migración `supabase/migrations/0017_movement_attachments.sql`:
- Enum `attachment_kind` = `'factura' | 'recibo' | 'comprobante'`.
- Tabla `movement_attachments(id, user_id, movement_id FK movements ON DELETE CASCADE, kind attachment_kind, file_url text, file_name text, file_size int, mime_type text, created_at, updated_at)`.
- Índice `(movement_id)`; RLS por `user_id` (select/insert/update/delete own) y trigger `set_updated_at` siguiendo `0004_movements_transfers.sql`.
- Bucket de Storage `attachments`, rutas `{userId}/{uuid}.{ext}`, políticas de Storage que limitan a la carpeta del propio usuario (privado; acceso vía signed URL o, si se opta por público como `icons`, documentarlo). Decisión por defecto: **bucket privado** y servir con `createSignedUrl`, porque comprobantes son datos sensibles (a diferencia de los íconos públicos).
- Reglas de cardinalidad (gasto ≤2 con kinds factura/recibo; ingreso ≤1 kind comprobante) se aplican en la capa de formulario/mutación; la tabla no las fuerza para mantener simplicidad.
- Alternativa descartada: columnas `*_url` en `movements` — menos flexible para metadata (nombre, tamaño, mime) y para borrado individual; jsonb — peor para RLS/consulta.

### D4 — Subida de adjuntos en la mutación, con rollback razonable
Flujo al crear: insert del movimiento → por cada archivo elegido, upload al bucket (`{user.id}/{uuid}.{ext}`) → insert en `movement_attachments` con el `kind` del slot. Al editar: comparar slots actuales vs nuevos; subir agregados, borrar quitados (Storage + fila). Reutiliza el patrón de validación de `icon-picker.tsx` (tipo/tamaño).
- Si falla un upload, se informa con toast y no se bloquea el movimiento ya creado; el usuario puede reintentar el adjunto desde la edición. (Trade-off aceptado para no transaccionar Storage+DB.)

### D5 — Fecha primero + `is_future` derivado
Mover el bloque de fecha al tope del form usando `MangoDatePicker`. Eliminar el checkbox "Futuro" y el campo `is_future` del form state visible. En la mutación, derivar `is_future` con una helper estilo `isInstallmentFuture(dateStr)` (reutilizar la de `installments.ts` o extraer una compartida `isFutureDate`). Aplica a movimientos y transferencias.
- Compatibilidad: el valor sigue persistiéndose en la columna `is_future`; los consumidores (badges, presupuesto) no cambian.

### D6 — Transferencia como tercer segmento del toggle
El toggle de tipo del modal pasa a Gasto / Ingreso / Transferencia. Al elegir Transferencia, el modal renderiza los campos de transferencia. Para evitar duplicar lógica, se reutiliza `transfer-form.tsx` (ajustado para selectores con ícono+buscador, fecha-primero con `MangoDatePicker`, `is_future` derivado) y la `transferMutation` existente.
- Opción de implementación (a decidir por el executor según menor fricción): (a) unificar dentro de `movement-form.tsx` un render condicional que monte el cuerpo de transferencia, o (b) que el toggle viva en el wrapper y conmute entre `MovementForm` y `TransferForm`. Preferencia: el toggle de tres estados vive donde hoy está el toggle Gasto/Ingreso (dentro del cuerpo del modal) para que el cambio sea inmediato sin re-montar el sheet.

## Risks / Trade-offs

- [Bucket privado + signed URLs añade complejidad al mostrar adjuntos] → Encapsular en una helper `getAttachmentUrl()`; si resulta excesivo para el MVP, degradar a bucket público documentando el riesgo de privacidad.
- [Upload no transaccional con la DB puede dejar archivos huérfanos o filas sin archivo] → Subir primero y solo insertar fila tras upload OK; limpiar en caso de error parcial; reintento desde edición.
- [Forzar moneda puede sorprender al usuario que ya había elegido una] → Reajustar al cambiar de cuenta y, en tarjetas, respetar la elección; cubierto por escenarios de la spec.
- [`is_future` derivado cambia el origen del dato] → Mantener la columna y su semántica; no recalcular históricos; verificar badges/filtros tras el cambio.
- [Unificar transferencias en el modal puede crecer `movement-form.tsx`] → Mantener `transfer-form.tsx` como componente separado y solo conmutar; respetar regla de archivos chicos.

## Migration Plan

1. Aplicar migración `0017_movement_attachments.sql` (tabla + enum + RLS + trigger) y crear bucket `attachments` con políticas por usuario.
2. Regenerar/actualizar `src/lib/database.types.ts`.
3. Implementar cambios de UI/lógica (selectores, fecha, moneda, adjuntos, toggle de 3 estados).
4. Verificar consumidores de `is_future` y el flujo de edición de movimientos.
- Rollback: revertir migración (drop tabla + enum) y bucket; el código nuevo es aditivo salvo la eliminación del checkbox "Futuro" (recuperable revirtiendo el componente).

## Open Questions

- ¿Bucket de adjuntos privado (signed URLs) o público como `icons`? Default propuesto: privado. Confirmar si el esfuerzo de signed URLs es aceptable para el MVP.
- ¿La edición de adjuntos vive en el mismo modal de edición de movimiento existente o requiere una vista nueva? Asumido: el modal/vista de edición actual de movimientos.
