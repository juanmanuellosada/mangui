## Why

El modal de "Nuevo movimiento" permite cargar combinaciones inválidas (un movimiento en USD sobre una cuenta en pesos que no es tarjeta), muestra indicadores redundantes, no deja adjuntar comprobantes, usa un selector de fecha nativo inconsistente con el resto de la app y no permite registrar transferencias. Estos vacíos obligan al usuario a saltar entre pantallas y producen datos incoherentes.

## What Changes

- **Coherencia de moneda según la cuenta**: si la cuenta seleccionada no es tarjeta de crédito, el movimiento queda forzado a la moneda de la cuenta y el selector de moneda (`CurrencyToggle`) se oculta por redundante. Solo las tarjetas de crédito permiten elegir una moneda distinta (con la sección cross-currency existente). **BREAKING** para el flujo de carga: ya no se puede mezclar moneda y cuenta libremente.
- **Selectores de Cuenta y Categoría mejorados**: el selector de Cuenta renderiza el ícono de la cuenta (emoji, logo de catálogo o imagen subida) igual que ya hace Categoría; ambos selectores ganan un buscador interno; pasan a estar en filas separadas en vez de un grid de dos columnas.
- **Adjuntos en movimientos** (cambio principal): un gasto admite 2 adjuntos ("Factura o ticket" + "Recibo / comprobante de pago") y un ingreso admite 1 ("Comprobante"). Imágenes y PDF hasta ~5MB, almacenados en Supabase Storage, gestionables tanto al crear como al editar. Las transferencias no llevan adjuntos.
- **Selector de fecha al inicio**: la fecha pasa a ser el primer campo y usa el `MangoDatePicker` personalizado. Se elimina el checkbox "Futuro"; `is_future` se deriva automáticamente de la fecha (futuro = fecha posterior a hoy).
- **Transferencias en el mismo modal**: el toggle de tipo pasa de Gasto/Ingreso a Gasto / Ingreso / Transferencia, reutilizando el formulario y la mutación de transferencia existentes.

## Capabilities

### New Capabilities
- `movement-entry`: carga y edición de movimientos (ingreso/gasto) desde el modal — coherencia de moneda según la cuenta, fecha como primer campo con date picker personalizado, `is_future` derivado de la fecha, y selectores de cuenta/categoría con ícono, buscador y en filas separadas.
- `movement-attachments`: adjuntar, ver y borrar comprobantes en un movimiento (gasto: factura + recibo; ingreso: comprobante), tanto al crear como al editar, con almacenamiento en Supabase Storage.
- `transfer-entry`: registrar transferencias entre cuentas desde el mismo modal de movimientos mediante un tercer modo en el toggle de tipo.

### Modified Capabilities
<!-- No existen specs previos en openspec/specs/; no hay capabilities a modificar. -->

## Impact

- **Frontend**: `src/components/movements/movement-form.tsx`, `src/components/quick-add-provider.tsx`, `src/components/transfers/transfer-form.tsx`, vista de edición/detalle de movimientos, `src/components/ui/mango-select.tsx` (prop `showSearch`), nuevo componente de adjuntos.
- **Reutiliza**: `renderAccountIcon` (`src/lib/accounts.ts`), `MangoDatePicker`, `IconPicker`/patrón de upload de Storage, `isInstallmentFuture` (`src/lib/installments.ts`).
- **Base de datos**: nueva migración `supabase/migrations/0017_*` con tabla `movement_attachments` (FK a `movements` con `ON DELETE CASCADE`, RLS por `user_id`, trigger `updated_at`), nuevo bucket de Storage `attachments` con políticas por usuario. Tipos en `src/lib/database.types.ts`.
- **Lógica de inserción**: `movementMutation` y `transferMutation` inline en `quick-add-provider.tsx` (upload de adjuntos + derivación de `is_future`).
- **Compatibilidad**: todo el código que ya consume `is_future` (badges "Programado", filtros de presupuesto) sigue funcionando; cambia el origen del valor (derivado, no manual).
