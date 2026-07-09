## 1. Motor de diff (puro)

- [x] 1.1 Crear `src/lib/statement-reconcile.ts` con `reconcileStatement(parsed, cycleMovements)` (puro) que devuelva `{ missing, extra, mismatched }`, matcheando por comercio normalizado (reusar `normalizeNote`/derivación de `purchase_key`) + monto + número de cuota.
- [x] 1.2 Extraer/compartir desde `statement-import.ts` los helpers de matching (comercio normalizado, purchase_key) sin cambiar el comportamiento del import.
- [x] 1.3 Tests puros (`statement-reconcile.test.ts`): falta, sobra, diferencia de monto, y matching correcto con descripciones variables del mismo comercio (ANTHROPIC vs CLAUDE.AI), líneas USD, y cuotas.

## 2. Aplicación reconciliable de lo faltante

- [x] 2.1 Resolver el vínculo con `import_statement_id`/`card_statements` del resumen corroborado y decidir el modo de persistencia: reusar `import_card_statement` (con su idempotencia) SIN borrar/pisar lo ya cargado. Si el DELETE previo por `import_statement_id` pisara movimientos existentes, definir un ajuste (modo "solo upsert" o payload acotado). Documentar la decisión.
- [x] 2.2 Construir el payload de aplicación solo con las líneas/cuotas tildadas (reusar `buildStatementPayload`/proyección de cuotas con close_date + tabla "Cuotas a vencer").
- [x] 2.3 Tests: agregar 1 faltante NO toca los demás movimientos del ciclo; re-aplicar lo mismo no duplica (reconciliación por purchase_key/import_statement_id); agregar una cuota proyecta sus futuras.

## 3. UI de corroborar (MangoSheet)

- [x] 3.1 Acción "Corroborar con IA" en el resumen puntual de `cards-list.tsx` (subir PDF ≤15MB, cuenta 1 uso de IA vía la ruta existente).
- [x] 3.2 Pantalla de diff (MangoSheet, estilo import): sección FALTA (checkboxes para agregar), DIFERENCIA DE MONTO (muestra PDF vs cargado), SOBRA (solo lectura/marcado). Reusar filas/badges del import.
- [x] 3.3 Al confirmar, aplicar solo lo tildado (punto 2); las cuotas faltantes agregan sus proyecciones. Nada automático; cerrar sin confirmar no persiste. Invalidar las queries correctas para que la vista Tarjetas refresque.
- [x] 3.4 Consultar `ui-ux-pro-max` para que el diff quede claro (colores por grupo, montos comparados) y consistente con el import.

## 4. Verificación

- [ ] 4.1 `npm run lint`, `npm run typecheck`, `npm test` en verde.
- [ ] 4.2 Verificación e2e con un PDF real: cargar un resumen incompleto, corroborar, ver el diff correcto (falta/sobra/diferencia), agregar lo faltante y confirmar que el total pasa a cuadrar sin duplicar.
