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

## 8. Pendiente — aplicar migración de esquema a prod

- [ ] 8.1 Aplicar `0028`/`0029` a la base de producción (bloqueado por el guardrail de permisos; lo aplica el usuario vía pipeline de migraciones / `supabase db push` o dashboard). Necesario para los adjuntos de resúmenes en prod.
