## Context

La sección Tarjetas (`src/app/(app)/app/tarjetas/page.tsx` → `src/components/cards/cards-list.tsx`, ~697 líneas) hoy muestra una tarjeta por vez (tabs) y solo el ciclo en curso. Los resúmenes pasados no se ven. `card_statements` se crea recién al pagar. El `RegisterPaymentDialog` (líneas ~112-268) usa `MoneyInput` con `currency="ARS"` hardcodeada, `<input type="date">` nativo, y `MangoSelect` sin íconos ni búsqueda; solo guarda el pago, sin adjuntos.

Infra existente reutilizable:
- `src/lib/cards.ts`: `nextCloseDate`, `previousCloseDate`, `currentCycleRange`, `computeDueDate`, `isInCycle`, `nextCardPayment`.
- Componentes: `CreditCardVisual`, `MoneyInput`, `MangoDatePicker`, `MangoSelect`, `AccountIconChip`, `AttachmentSlot`.
- `MovementForm` se abre vía `useQuickAdd().open("movement")`; soporta gastos de tarjeta con cuotas y slots de adjuntos.
- `src/lib/attachments.ts`: `uploadAttachment`, `deleteAttachment`, `listAttachments`, `getAttachmentUrl`, `validateAttachmentFile`. Tabla `movement_attachments` (kind: factura|recibo|comprobante; FK movement_id|transfer_id).
- Tabla `card_statements`: account_id, close_date, due_date, total_amount, stamp_tax, status (pendiente|pagado), paid_amount, paid_from_account_id, paid_date, transfer_id, UNIQUE(account_id, close_date).

## Goals / Non-Goals

**Goals:**
- Mostrar todas las tarjetas con todos sus resúmenes navegables y autocalculados.
- Unificar los inputs del modal de pago con los del resto de la app.
- Permitir alta de gastos en resúmenes no pagados.
- Doble adjunto (resumen + comprobante) al pagar.
- Sembrar datos demo en prod (ops).

**Non-Goals:**
- No se cambia el cálculo de ciclos ni el modelo de cuotas (`installment_purchases`).
- No se materializan filas de resumen por ciclo (se mantienen virtuales).
- No se rediseña `MovementForm` ni los componentes de input.
- No se toca el flujo de transferencias.

## Decisions

### D1: Resúmenes virtuales en lugar de persistidos
Se enumeran los ciclos de cada tarjeta en memoria a partir de sus movimientos y se calcula cada total al vuelo. Una fila `card_statements` se crea/actualiza solo al pagar (clave `(account_id, close_date)` con upsert, como hoy).
- **Por qué**: fuente de verdad única (`movements`), sin backfill ni triggers, totales siempre exactos mientras no esté pagado.
- **Alternativa descartada**: materializar una fila por ciclo → riesgo de totales desactualizados y complejidad de recálculo.

### D2: Helper `listCardCycles(account, movements)` en `src/lib/cards.ts`
Nuevo helper que, dada una tarjeta y sus movimientos, devuelve la lista ordenada de ciclos (cada uno: `closeDate`, `dueDate`, `cycleStart`, `cycleEnd`, movimientos del ciclo, total). El rango va del ciclo del movimiento más antiguo hasta el ciclo en curso, más ciclos futuros con movimientos (cuotas). Cada ciclo se cruza con la fila `card_statements` (si existe) para conocer `status`/`paid_*`.
- **Por qué**: centraliza la lógica de enumeración para la UI y deja `cards-list.tsx` declarativo.

### D3: Estado de navegación por tarjeta
Cada bloque mantiene el índice del resumen visible (default = ciclo en curso). Las flechas ‹ › mueven el índice dentro de la lista de `listCardCycles`. Se deshabilitan en los extremos.

### D4: Migración de adjuntos para resúmenes
Nueva migración que: (a) agrega `'resumen'` al enum de `kind` de adjuntos; (b) agrega `statement_id uuid` (FK `card_statements(id)` ON DELETE CASCADE, nullable) a `movement_attachments` + índice; (c) ajusta el CHECK de "exactamente un padre" si existe (movement_id XOR transfer_id XOR statement_id) y agrega/ajusta políticas RLS para que el dueño de la tarjeta gestione adjuntos de sus resúmenes.
- **Por qué**: reusar `movement_attachments` evita una tabla nueva; el comprobante ya usa `'comprobante'`, falta `'resumen'`.
- **Nota**: agregar valor a un enum en Postgres requiere `ALTER TYPE ... ADD VALUE` (no transaccional con uso inmediato en algunas versiones); la migración debe contemplarlo.

### D5: `attachments.ts` acepta `statement_id`
`uploadAttachment` y `listAttachments` se extienden para aceptar/filtrar por `statement_id`. `AttachmentSlot` se reutiliza tal cual (dos instancias: kind `resumen` y kind `comprobante`).

### D6: Alta de gasto desde un resumen
"+ Gasto" llama a `useQuickAdd().open("movement", { presetAccountId, presetDate })` (o el mecanismo de preset equivalente del `MovementForm`). Si el preset no existe aún, se agrega soporte mínimo de valores iniciales al form. Solo visible si `status !== 'pagado'`.

### D7: Modal de pago reescrito
`RegisterPaymentDialog` pasa a usar `MoneyInput currency={card.currency}`, `MangoDatePicker`, `MangoSelect` con `leading: <AccountIconChip>` y `showSearch`, más dos `AttachmentSlot`. Al confirmar: upsert de `card_statements` y subida de los adjuntos pendientes con el `statement_id` resultante.

## Risks / Trade-offs

- [Recalcular ciclos en cliente con muchos movimientos puede ser costoso] → la cantidad de movimientos por tarjeta es acotada; se memoiza `listCardCycles`.
- [`ALTER TYPE ... ADD VALUE` no corre dentro de una transacción en algunas versiones de Postgres] → escribir la migración para que el `ADD VALUE` quede aislado del resto del DDL.
- [Subir adjunto y luego fallar el insert deja archivo huérfano] → mismo comportamiento que hoy en movimientos; recuperable desde la vista del resumen pagado.
- [Escribir en la cuenta demo de prod es difícil de revertir] → mostrar el SQL al usuario y ejecutar solo tras aprobación; acotar a la cuenta demo por su `user_id`.

## Migration Plan

1. Aplicar migración SQL (enum `resumen` + `statement_id` + índice + RLS) en local/Supabase.
2. Extender `attachments.ts` y `cards.ts`.
3. Reescribir `cards-list.tsx` (layout + modal de pago) y wiring de "+ Gasto".
4. Verificar build/lint y QA visual.
5. (Ops) Ejecutar SQL de seed demo en prod tras aprobación del usuario.
- **Rollback**: la migración es aditiva (columna nullable + valor de enum); revertir el código UI restaura el comportamiento previo sin pérdida de datos.

## Open Questions

- Ninguna bloqueante. El mecanismo exacto de "preset" del `MovementForm` se confirma al implementar (D6).
