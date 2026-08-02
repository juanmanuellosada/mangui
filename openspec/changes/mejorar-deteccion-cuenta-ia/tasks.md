## 1. Arreglo del fallback silencioso (capa 0)

- [x] 1.1 En `src/components/ai/ai-chat.tsx:151-157`, eliminar el fallback `?? accounts[0]?.id ?? ""` de la resolución de cuenta del borrador; que quede sin cuenta, simétrico con la categoría (que ya cae a `null`)
- [x] 1.2 Asegurar que el borrador del chat con cuenta vacía se muestre con el campo visible y requerido, y que no se pueda confirmar sin elegirla

## 2. Base de datos del aprendizaje

- [x] 2.1 Crear `supabase/migrations/0058_account_learning.sql` con la tabla `account_learning` (columnas, `UNIQUE (user_id, context_kind, context_key, account_id)`, `CHECK` de `context_kind`, índice `(user_id, context_kind, context_key)`), siguiendo `0045_category_learning.sql`
- [x] 2.2 Agregar RLS con las cuatro policies `auth.uid() = user_id`
- [x] 2.3 Agregar el RPC `bump_account_learning(p_category_id uuid, p_currency text, p_merchant_key text, p_account_id uuid)`: `SECURITY DEFINER`, `SET search_path = ''`, `user_id` tomado de `auth.uid()` (nunca de parámetro), hasta dos upserts con `ON CONFLICT DO UPDATE hit_count + 1`, más `REVOKE ALL FROM PUBLIC` / `GRANT EXECUTE TO authenticated` / `REVOKE EXECUTE FROM anon`
- [x] 2.4 Regenerar `src/lib/database.types.ts` con la tabla y el RPC nuevos

## 3. Normalización y resolver compartidos (capa 2)

- [x] 3.1 Crear la utilidad de normalización de texto compartida (lowercase → NFD → strip diacríticos → no-alfanumérico a espacio → colapsar espacios → trim) y su tokenizador (descarta tokens de menos de 2 caracteres)
- [x] 3.2 Implementar el cálculo de puntaje `0.7 × coverage + 0.3 × specificity` con match de token por prefijo y atajo a `1.0` en igualdad normalizada, con las constantes de umbral (`0.45`) y margen mínimo sobre el segundo (`0.15`) exportadas
- [x] 3.3 Implementar el resolver que devuelve la cuenta elegida con su puntaje, o un resultado explícito de "no resuelto", excluyendo cuentas ocultas (`is_hidden`)
- [x] 3.4 Escribir los tests del resolver cubriendo: parcial no contiguo (`"Santander Visa"` → `Santander Río - Visa Signature`), falso positivo por cuenta corta contenida en una larga (`Visa` vs `Visa Santander Platinum`, en los dos órdenes de array), ambigüedad por debajo del margen, hint por debajo del umbral, cuentas ocultas excluidas, e insensibilidad a mayúsculas y acentos

## 4. Migración de los llamadores al resolver

- [x] 4.1 Reemplazar `_norm`/`matchByName` en `src/components/movements/movement-form.tsx:143` por el resolver compartido
- [x] 4.2 Reemplazar `normalizeStr`/`findIdByName` en `src/components/ai/ai-chat.tsx:41` por el resolver compartido
- [x] 4.3 Reemplazar `normalizeStr`/`findIdByName` en `src/lib/ai/tools.ts:31` (usado por `buscar_movimientos` y, en su forma inline, por `resumenes_tarjeta:397`) por el resolver compartido
- [x] 4.4 Reemplazar `normalizeText`/`matchCategoryId` en `src/components/cards/import-statement-flow.tsx:68` por el resolver compartido
- [x] 4.5 Verificar que no queden copias del snippet NFD en los archivos migrados y que el resto de los llamadores del repo sigan compilando

## 5. Contrato por índice con el modelo (capa 1)

- [x] 5.1 En `src/lib/ai/extract-movement.ts`, agregar `cuenta_idx: number | null` al schema manteniendo `cuenta: string | null` como fallback, y cambiar el prompt para presentar las cuentas numeradas con tipo y moneda en lugar de la línea pipe-separada
- [x] 5.2 En `src/app/api/ai/extract-movement/route.ts`, aceptar `accounts` con metadata (nombre, tipo, moneda) además del formato actual de solo nombres, respetando el cap de 100
- [x] 5.3 En `src/components/movements/ai-fill-bar.tsx:43`, mandar la metadata de cada cuenta en lugar de solo `a.name`
- [x] 5.4 En `movement-form.tsx`, consumir `cuenta_idx` validando que esté dentro del rango de la lista enviada; si es inválido o ausente, caer al resolver por nombre
- [x] 5.5 Aplicar el mismo cambio de contrato en `src/app/api/ai/import-statement/route.ts` y `src/components/cards/import-statement-flow.tsx:589`
- [x] 5.6 Resolver la pregunta abierta del `account_hint` de `src/lib/ai/statement-schema.ts:42` (hoy extraído y descartado): conectarlo al resolver como sugerencia de tarjeta, o quitarlo del schema
- [x] 5.7 Escribir tests de la validación del índice: dentro de rango, fuera de rango, ausente con string presente, ausente sin string

## 6. Aprendizaje de cuenta (capa 3)

- [x] 6.1 Crear el módulo de aprendizaje de cuenta con la construcción de las claves de contexto (`"<category_id>:<currency>"` y `merchantKey(note)` reusando `src/lib/category-learning.ts:20`), la selección del mejor candidato (filtro por contexto, orden por `hit_count`, desempate por `last_used_at`, mínimo de repeticiones) y la escritura fire-and-forget que nunca lanza
- [x] 6.2 Crear el hook de React Query para leer `account_learning`, siguiendo `src/lib/hooks/use-category-learning.ts`
- [x] 6.3 Llamar al RPC en el `onSuccess` de la mutation de creación en `src/components/quick-add-provider.tsx:323`, junto al `recordCategoryLearning` existente, e invalidar la cache
- [x] 6.4 Integrar el prior como término del puntaje del resolver: hasta `+0.20` escalado por `hit_count` y saturado en ese tope, solo para el candidato aprendido del contexto
- [x] 6.5 Cuando no hay hint de cuenta pero sí un prior fuerte, mostrar la cuenta aprendida como sugerencia descartable en vez de completarla en silencio, reusando el patrón `learnHint` de `movement-form.tsx:732`
- [x] 6.6 Escribir los tests del aprendizaje: se aprende al confirmar, el prior desempata un parcial ambiguo, el prior no resuelve solo cuando el hint no se parece a nada, el prior no pisa una señal fuerte hacia otra cuenta, y el mínimo de repeticiones

## 7. Precedencia y verificación

- [x] 7.1 Implementar la precedencia `usuario > índice del modelo > puntaje con prior` en `movement-form.tsx`, reusando el mecanismo de guarda de campo tocado por el usuario (`userSetCategory.current`)
- [ ] 7.2 Verificar a mano los escenarios del spec en la app: nombre parcial acierta, cuenta corta no le gana a la larga, sin resolución el campo queda vacío y visible, y el borrador del chat no preselecciona ninguna cuenta
- [x] 7.3 Correr `npm run lint`, `npm run typecheck` y `npm test`, y dejar todo en verde
