## 1. Base de datos y tipos (adjuntos)

- [x] 1.1 Crear migración `supabase/migrations/0017_movement_attachments.sql`: enum `attachment_kind` (`factura`,`recibo`,`comprobante`) y tabla `movement_attachments` (id, user_id, movement_id FK movements ON DELETE CASCADE, kind, file_url, file_name, file_size, mime_type, created_at, updated_at) siguiendo el patrón de `0004_movements_transfers.sql`
- [x] 1.2 Agregar índice `(movement_id)`, habilitar RLS con políticas select/insert/update/delete por `user_id`, y trigger `set_updated_at`
- [x] 1.3 Crear bucket de Storage `attachments` (privado) con políticas que restrinjan cada usuario a su carpeta `{userId}/...`
- [x] 1.4 Actualizar `src/lib/database.types.ts` con la tabla `movement_attachments` y el enum nuevo
- [x] 1.5 Crear helper de datos para adjuntos (subir a Storage con validación tipo/tamaño ~5MB imágenes+PDF, insertar fila, borrar fila+archivo, y resolver URL de visualización vía signed URL)

## 2. MangoSelect: buscador + ícono de cuenta

- [x] 2.1 Agregar prop `showSearch?: boolean` a `src/components/ui/mango-select.tsx` con input de filtro y filtrado por `label` (insensible a mayúsculas/acentos), preservando teclado/accesibilidad actuales
- [x] 2.2 En el selector de cuenta del formulario, pasar `leading: renderAccountIcon(a.icon, …)` y `showSearch`; activar `showSearch` también en el selector de categoría

## 3. Formulario de movimiento: moneda, fecha, layout

- [x] 3.1 Mover el selector de fecha al inicio del formulario usando `MangoDatePicker` (default hoy) en reemplazo del input nativo
- [x] 3.2 Eliminar el checkbox "Futuro" del formulario y derivar `is_future` desde la fecha en la mutación (helper compartida tipo `isFutureDate`, reutilizar/extraer de `isInstallmentFuture`)
- [x] 3.3 Forzar `original_currency = account.currency` y ocultar `CurrencyToggle` cuando la cuenta no es `tarjeta_credito`; mostrar el toggle solo para tarjetas; reajustar moneda al cambiar de cuenta
- [x] 3.4 Agregar refinamiento Zod que rechace moneda distinta a la de la cuenta cuando la cuenta no es tarjeta
- [x] 3.5 Reorganizar cuenta y categoría en filas separadas (quitar el grid de 2 columnas)

## 4. Adjuntos en el formulario de movimiento

- [x] 4.1 Crear componente de slot de adjunto (subir/preview/borrar) reutilizando la validación del `icon-picker`
- [x] 4.2 Renderizar slots según tipo: gasto → "Factura o ticket" + "Recibo / comprobante de pago"; ingreso → "Comprobante"; transferencia → ninguno
- [x] 4.3 Integrar la subida de adjuntos en `movementMutation` (insert movimiento → upload archivos → insert filas con `kind`), con toast de error sin bloquear el movimiento creado
- [x] 4.4 Soportar adjuntos en la vista/modal de edición de movimiento: cargar existentes, agregar en slots vacíos permitidos, borrar (Storage + DB)

## 5. Transferencias en el modal

- [x] 5.1 Convertir el toggle de tipo Gasto/Ingreso en Gasto / Ingreso / Transferencia dentro del modal
- [x] 5.2 Al elegir Transferencia, renderizar el cuerpo de transferencia (reutilizando `transfer-form.tsx`/su lógica y `transferMutation`) sin re-montar el sheet
- [x] 5.3 Aplicar al modo transferencia: selectores de cuenta con ícono+buscador, fecha-primero con `MangoDatePicker`, `is_future` derivado, filas separadas; eliminar su checkbox "Futuro"
- [x] 5.4 Validar que origen y destino no sean la misma cuenta; preservar el flujo cross-currency existente

## 6. Verificación

- [ ] 6.1 Aplicar la migración en local y verificar RLS (un usuario no accede a adjuntos de otro)
- [ ] 6.2 Probar manualmente: coherencia de moneda (no-tarjeta vs tarjeta), buscador e íconos en ambos selectores, fecha al inicio + `is_future` derivado (badge "Programado"), adjuntos gasto/ingreso al crear y editar, y creación de transferencia desde el toggle
- [ ] 6.3 Verificar que los consumidores de `is_future` (badges, filtros de presupuesto) siguen funcionando
- [x] 6.4 Correr lint/typecheck del proyecto — `tsc --noEmit` pasa limpio; los errores de ESLint (`set-state-in-effect`, `Date.now` en render de `rules-list.tsx`) son preexistentes y no introducidos por este cambio
