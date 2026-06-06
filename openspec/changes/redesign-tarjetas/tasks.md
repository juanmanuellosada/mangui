## 1. Datos (migración Supabase)

- [x] 1.1 Crear migración en `supabase/migrations/` que agregue el valor `'resumen'` al enum de `kind` de adjuntos (aislando el `ALTER TYPE ... ADD VALUE`).
- [x] 1.2 En la misma serie de migración, agregar columna `statement_id uuid` a `movement_attachments` con FK a `card_statements(id) ON DELETE CASCADE` (nullable) + índice por `statement_id`.
- [x] 1.3 Ajustar el CHECK de padre único (movement_id / transfer_id / statement_id) y las políticas RLS para que el dueño de la tarjeta gestione adjuntos de sus resúmenes.
- [x] 1.4 Aplicar la migración en local/Supabase y regenerar tipos TS si el proyecto los usa.

## 2. Lógica reutilizable

- [x] 2.1 Agregar `listCardCycles(account, movements, statements)` en `src/lib/cards.ts`: devuelve ciclos ordenados (closeDate, dueDate, cycleStart, cycleEnd, movimientos, total, status/paid_* desde `card_statements`) desde el primer movimiento hasta el ciclo en curso, más ciclos futuros con movimientos.
- [x] 2.2 Extender `src/lib/attachments.ts`: `uploadAttachment` acepta `statement_id`; `listAttachments` permite filtrar por `statement_id`; soportar `kind = 'resumen'`.

## 3. Modal Registrar pago (corrección de inputs + adjuntos)

- [x] 3.1 Reescribir `RegisterPaymentDialog` en `src/components/cards/cards-list.tsx`: `MoneyInput` con `currency={card.currency}` (quitar ARS hardcodeado).
- [x] 3.2 Reemplazar el `<input type="date">` nativo por `MangoDatePicker`.
- [x] 3.3 Cambiar el `MangoSelect` de cuenta de origen para incluir `leading: <AccountIconChip>` y `showSearch` (igual que el selector de cuenta del `MovementForm`).
- [x] 3.4 Agregar dos `AttachmentSlot` (kind `resumen` y kind `comprobante`); al confirmar, hacer upsert de `card_statements` y subir los adjuntos pendientes con el `statement_id` resultante.

## 4. Rediseño de la sección (layout)

- [x] 4.1 Reescribir `src/components/cards/cards-list.tsx` a una lista vertical de bloques (uno por tarjeta) usando `CreditCardVisual`; eliminar el patrón de tabs de una tarjeta a la vez.
- [x] 4.2 En cada bloque, mostrar el resumen seleccionado (total autocalculado, fechas de cierre/vencimiento, estado) y la navegación inline ‹ anterior / siguiente › entre los resúmenes de esa tarjeta (deshabilitar en los extremos).
- [x] 4.3 Mostrar los gastos del ciclo del resumen visible y el bloque "A pagar"/estado de pago según `card_statements`.
- [x] 4.4 Acción "Registrar pago" por resumen (abre el modal del paso 3) y, solo si `status !== 'pagado'`, acción "+ Gasto".
- [x] 4.5 Estado vacío cuando no hay tarjetas de crédito.
- [x] 4.6 Aplicar pulido visual/UX con la skill `ui-ux-pro-max` respetando el sistema bespoke.

## 5. Alta de gasto desde un resumen

- [x] 5.1 Implementar "+ Gasto" abriendo el `MovementForm` preseteado a la tarjeta del bloque y con fecha por defecto dentro del ciclo del resumen (agregar soporte de valores iniciales/preset al form si no existe).
- [x] 5.2 Verificar que al agregar el gasto el total del resumen no pagado se recalcula.

## 6. Verificación

- [x] 6.1 `next build` / `eslint` sin errores; revisar tipos.
- [ ] 6.2 QA manual: navegación de resúmenes, pago con doble adjunto (resumen + comprobante), alta de gasto en resumen no pagado, monedas ARS/USD.

## 7. Ops — seed de la cuenta demo (prod)

- [x] 7.1 Identificar el `user_id` de la cuenta demo (`demo.mangui@gmail.com`) en Supabase prod. (`54353bbe-…`)
- [x] 7.2 Redactar el SQL para insertar 1 tarjeta nueva + varios ciclos de movimientos + upsert de `card_statements` pagados, y MOSTRARLO al usuario para aprobación antes de ejecutar.
- [x] 7.3 Ejecutar el SQL en prod tras aprobación y verificar en la app demo. (Mastercard Macro `e9e102a8-…`, 19 gastos, 3 resúmenes pagados.)

## 8. Aplicar migración de esquema a prod

- [x] 8.1 Aplicar `0028`/`0029` a la base de producción. Aplicadas y verificadas. Código pusheado a `main` (deploy Vercel).

## 9. Pago multi-moneda (consumos en pesos y dólares)

- [x] 9.1 Migración `0030`: agregar a `card_statements` columnas para el saldo/pago en la 2ª moneda — `total_amount_usd numeric default 0`, `paid_amount_usd numeric`, `paid_from_account_id_usd uuid` (FK accounts). El `total_amount`/`paid_amount`/`paid_from_account_id` existentes representan el saldo en la moneda principal (ARS).
- [x] 9.2 `listCardCycles` (`src/lib/cards.ts`): calcular subtotales por `original_currency` (sin convertir) además del total. Exponer p. ej. `totalsByCurrency: { ARS, USD }` por ciclo.
- [x] 9.3 UI del bloque de tarjeta: cuando un resumen tiene más de una moneda, mostrar los dos subtotales (ARS y USD) en lugar del único total convertido.
- [x] 9.4 `RegisterPaymentDialog`: si el resumen tiene saldo en 2 monedas, mostrar dos `MoneyInput` (prellenados con cada subtotal) y dos `MangoSelect` de cuenta, cada selector filtrado a cuentas de esa moneda. Si hay una sola moneda, comportamiento actual. Al confirmar, persistir ambos pagos en `card_statements`.
- [x] 9.5 Build/typecheck; checkear que tipos de `database.types.ts` incluyan las columnas nuevas.
- [x] 9.6 Ops: aplicar `0030` a prod y sembrar 1-2 consumos en USD en el resumen de Mayo de la demo (Mastercard Macro). Aplicada y verificada; Mayo = ARS 125.200 + USD 64,99.

## 10. Gastos del resumen unificados + detalle de cuotas como modal con postergación

- [x] 10.1 En `cards-list.tsx`, fusionar `cuotaMovements` y `regularMovements` en una sola lista "Gastos del resumen" (eliminar la sección separada "Cuotas que caen en este resumen"). Las filas de cuota muestran "Cuota X/Y".
- [x] 10.2 Cada fila de gasto usa `CategoryIconChip` (de `src/lib/categories.ts`) con el ícono de la categoría, reemplazando el `ShoppingBag` fijo.
- [x] 10.3 Convertir el "Detalle de cuotas" en un modal (`MangoSheet`): extraer el cuerpo de `installment-detail.tsx` a un componente reutilizable y abrirlo desde la fila de cuota (sin navegar a `/app/cuotas/[id]`). Mantener la ruta `/app/cuotas/[id]` funcionando reusando el mismo componente.
- [x] 10.4 En el detalle, agregar controles +1 mes / −1 mes por cuota NO pagada: al mover una cuota, esa y todas las siguientes se corren ese mes (cascada), recomputando `is_future`. Batch update de `movements.date`. Si cuota 1 se mueve, actualizar `installment_purchases.start_date`.
- [x] 10.5 Reglas de bloqueo: las cuotas en un resumen pagado no se mueven; deshabilitar −1 (o +1) cuando el desplazamiento llevaría una cuota afectada a un resumen ya pagado. Invalidar queries para que los resúmenes recalculen.
- [x] 10.6 Build/typecheck; QA visual (lista unificada con íconos, modal de cuotas, postergar +1/−1 con cascada).
