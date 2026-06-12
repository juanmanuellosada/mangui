## 1. Capa de datos (argentinadatos.ts)

- [x] 1.1 Confirmar contra la API real el shape de cada endpoint nuevo: `/v1/finanzas/cuentas-remuneradas-usd`, `/v1/finanzas/letras`, `/v1/finanzas/criptopesos`, `/v1/finanzas/tasas/plazo-fijo-uva-pago-periodico`, `/v1/finanzas/tasas/plazo-fijo-precancelable` (nombres de campos de tasa, vencimiento, moneda)
- [x] 1.2 Agregar tipos para cada instrumento nuevo en `src/lib/rendimientos/argentinadatos.ts`
- [x] 1.3 Implementar fetcher de Cuentas Remuneradas USD (normalizar a entidad + tasa, orden desc)
- [x] 1.4 Implementar fetcher de Letras: TNA/TEA + vencimiento, filtrar vencidas con TZ America/Argentina/Buenos_Aires, orden por rendimiento desc
- [x] 1.5 Ampliar el fetcher de cripto: USDT + USDC + DAI + staking (`/rendimientos`) y criptopesos (`/criptopesos`), etiquetando moneda
- [x] 1.6 Implementar fetcher de Plazo Fijo UVA (pago periódico + precancelable), etiquetar modalidad
- [x] 1.7 Mantener `Promise.allSettled` para que la falla de un endpoint no afecte al resto

## 2. Curación marca→logo (marcas.ts)

- [x] 2.1 Crear `src/lib/rendimientos/marcas.ts` con mapa declarativo entidad/fondo → `{ marca, logo, conocida }`
- [x] 2.2 Implementar matching tolerante (lowercase, sin acentos, includes de tokens) para variaciones del feed
- [x] 2.3 Resolver logos desde `public/icons/` (set fintech AR) con fallback a inicial
- [x] 2.4 Poblar el mapa con las marcas principales: Mercado Pago, Ualá, Personal Pay, Cocos, Naranja X, Prex, Lemon (+ las que aparezcan en el feed)
- [x] 2.5 Aplicar curación a FCI ARS, FCI USD y cualquier ranking por entidad (marca como principal, nombre técnico como subtítulo)

## 3. API route

- [x] 3.1 Ampliar el payload de `src/app/api/rendimientos/route.ts` con `cuentasRemuneradasUsd`, `letras`, `pfUva` y cripto ampliada (aditivo, sin romper claves existentes)
- [x] 3.2 Adjuntar a cada ítem la info de marca/logo y el flag `conocida`
- [x] 3.3 Verificar que se mantiene ISR 6h

## 4. UI (rendir-view.tsx)

- [x] 4.1 Agregar las secciones nuevas reusando `Section` + `RateRow` + `RateLogo`: Cuentas Remuneradas USD, Letras, Cripto ampliado, Plazo Fijo UVA
- [x] 4.2 Render de campos extra: vencimiento en Letras, modalidad en PF UVA, moneda en cripto
- [x] 4.3 Agregar toggle "Conocidas / Todas" (control segmentado / MangoSelect), default = Conocidas, global a la página
- [x] 4.4 Filtrar por `conocida` según el toggle en los rankings por entidad
- [x] 4.5 Mantener disclaimers (cripto: riesgo de custodia; pie: atribución ArgentinaDatos + tasas estimadas)
- [x] 4.6 Conservar el hero personalizado (plata idle + proyección) y considerar las nuevas categorías USD en las "mejores opciones" cuando corresponda
- [x] 4.7 Skeletons / empty states por sección nueva

## 5. Verificación

- [x] 5.1 `npm run build` pasa limpio
- [ ] 5.2 Probar `/rendir` con datos reales: las 4 secciones nuevas cargan y ordenan bien
- [ ] 5.3 Verificar toggle Conocidas/Todas (default conocidas, marcas con logo, fondos técnicos como subtítulo)
- [ ] 5.4 Verificar empty states ante falla de un endpoint (no rompe el resto de la página)
- [ ] 5.5 Verificar hero personalizado intacto y `RendirNudge` del dashboard sin regresiones
