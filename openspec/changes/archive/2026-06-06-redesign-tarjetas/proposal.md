## Why

La sección Tarjetas hoy muestra solo una tarjeta a la vez y solo el ciclo en curso; los resúmenes pasados no son visibles ni navegables, y un resumen solo "existe" cuando se registra un pago. Además el modal de pago usa inputs distintos a los del resto de la app (fecha nativa, selector de cuenta sin íconos/búsqueda) y solo permite adjuntar el comprobante. El usuario necesita ver todas sus tarjetas, recorrer todos sus resúmenes (autocalculados), corregir gastos olvidados antes de pagar, y adjuntar tanto el resumen como el comprobante al pagar.

## What Changes

- Rediseño de la sección Tarjetas: lista vertical con un bloque por tarjeta, cada uno con su visual, el resumen seleccionado, navegación inline ‹ anterior / siguiente › entre los resúmenes de esa tarjeta, y acciones (Registrar pago, + Gasto) + gastos del ciclo.
- **Resúmenes virtuales**: cada resumen se calcula en vivo desde los movimientos de su ciclo (helpers de `src/lib/cards.ts`). Se persiste una fila en `card_statements` **solo** al registrar el pago. Los `movements` siguen siendo la fuente de verdad.
- Navegación de todos los resúmenes de una tarjeta: desde el primer movimiento hasta el ciclo en curso, más ciclos futuros con movimientos (cuotas).
- Alta de gastos sobre un resumen **no pagado**: "+ Gasto" abre el `MovementForm` preseteado a esa tarjeta con la fecha por defecto dentro del ciclo del resumen.
- Corrección del modal Registrar pago para reusar los componentes canónicos: `MoneyInput` (con la currency de la tarjeta), `MangoDatePicker` (reemplaza el `<input type="date">` nativo) y `MangoSelect` con `AccountIconChip` + búsqueda (igual que el selector de cuenta del nuevo movimiento).
- Doble adjunto al pagar: uno para el **resumen** y otro para el **comprobante**, reusando `AttachmentSlot` y los helpers de `src/lib/attachments.ts`.
- **BREAKING (datos)**: nueva migración que agrega el valor `'resumen'` al enum de `kind` de adjuntos y la columna `statement_id` (FK a `card_statements`) en `movement_attachments`.
- Ops (fuera de la app): sembrar 1 tarjeta nueva + varios resúmenes/gastos en la cuenta demo de producción vía SQL de Supabase.

## Capabilities

### New Capabilities
- `credit-card-statements`: visualización de todas las tarjetas y todos sus resúmenes autocalculados, navegación entre resúmenes, alta de gastos en resúmenes no pagados, registro de pago con inputs canónicos y doble adjunto (resumen + comprobante).

### Modified Capabilities
<!-- Ninguna: no hay specs existentes de tarjetas cuyo contrato cambie. -->

## Impact

- **UI**: `src/app/(app)/app/tarjetas/page.tsx`, `src/components/cards/cards-list.tsx` (reescritura del layout y del `RegisterPaymentDialog`). Reusa `CreditCardVisual`, `MoneyInput`, `MangoDatePicker`, `MangoSelect`, `AccountIconChip`, `AttachmentSlot`, `MovementForm`.
- **Lógica**: `src/lib/cards.ts` (helper para enumerar los ciclos/resúmenes de una tarjeta), `src/lib/attachments.ts` (soporte de `statement_id` y kind `resumen`).
- **Datos**: nueva migración en `supabase/migrations/` (enum `attachment_kind` + columna `statement_id` + índice + RLS). Tabla `card_statements` ya existe.
- **Ops/Prod**: cuenta demo en Supabase producción (paso manual, SQL revisado antes de ejecutar).
