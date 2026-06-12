## Context

`/rendir` ya existe y funciona: `src/components/rendir/rendir-view.tsx` (client, TanStack Query) consume `src/app/api/rendimientos/route.ts` (GET, ISR 6h), que a su vez usa `src/lib/rendimientos/argentinadatos.ts` para traer datos de la API pública **ArgentinaDatos** (sin auth). Hoy expone 5 secciones (Plazo Fijo, Billeteras, FCI Mercado de Dinero, FCI USD, Stablecoins USDT) y un hero personalizado con la plata "idle" del usuario (saldos líquidos de la vista Supabase `account_balances`).

Dos problemas: (1) faltan instrumentos que sí tiene comparatasas.ar, y (2) los rankings de FCI muestran nombres técnicos de fondos mayoristas que el usuario no reconoce.

Este cambio amplía la misma arquitectura (no cambia fuente de datos ni stack) agregando secciones y una capa de curación marca→logo.

## Goals / Non-Goals

**Goals:**
- Agregar 4 instrumentos nuevos (Cuentas Remuneradas USD, LECAPs/Letras, Cripto ampliado, Plazo Fijo UVA) usando endpoints existentes de ArgentinaDatos.
- Curar los rankings por entidad mapeando fondo/entidad → marca de consumo conocida + logo, con toggle "Conocidas / Todas".
- Mantener intacto el hero personalizado y el `RendirNudge`.

**Non-Goals:**
- Cauciones y Créditos Hipotecarios UVA (sin endpoint gratuito; se evaluarán aparte, posiblemente vía MCP de IOL u otra fuente).
- Persistir histórico de tasas en Supabase (sigue siendo on-demand con caché).
- Cualquier feature de IA.

## Decisions

### D1: Extender el fetcher existente, no reescribirlo
Se agregan funciones y tipos a `src/lib/rendimientos/argentinadatos.ts` para los nuevos endpoints, en paralelo a los actuales, y se siguen disparando en `Promise.allSettled` desde la API route para que la falla de un endpoint no tumbe al resto.
- Endpoints nuevos: `/v1/finanzas/cuentas-remuneradas-usd`, `/v1/finanzas/letras`, `/v1/finanzas/criptopesos`, `/v1/finanzas/tasas/plazo-fijo-uva-pago-periodico`, `/v1/finanzas/tasas/plazo-fijo-precancelable`. Cripto ampliado reusa `/v1/finanzas/rendimientos` (hoy ya consumido para USDT) ampliando el filtro a USDC/DAI/staking.
- *Alternativa descartada:* un cliente genérico nuevo — innecesario, agrega complejidad sin beneficio.

### D2: Normalización de tasas (TNA/TEA/vencimiento)
Cada sección normaliza a una forma común que la UI ya entiende (entidad, nota, tasa %, logo opcional) más campos extra cuando aplican:
- **Letras:** símbolo, TNA y/o TEA, `vencimiento` (ISO). Se filtran las vencidas usando la fecha en TZ `America/Argentina/Buenos_Aires`. El orden es por rendimiento descendente.
- **PF UVA:** se etiqueta modalidad (pago periódico / precancelable) en la nota.
- **Cripto:** se etiqueta la moneda (USDT/USDC/DAI/criptopesos) y se conserva el disclaimer de riesgo.
- *Alternativa descartada:* normalizar todo a un único número y perder vencimiento/modalidad — pierde info que el usuario necesita para decidir.

### D3: Capa de curación marca→logo en módulo aparte
Nuevo `src/lib/rendimientos/marcas.ts` con un mapa declarativo `claveFondo/entidad → { marca, logo, conocida: true }`. El matching se hace por normalización del nombre (lowercase, sin acentos, includes de tokens conocidos) para tolerar variaciones del feed. Los logos se reusan del set de fintech AR ya bundleado en `public/icons/` cuando exista; si no, fallback a inicial.
- El flag `conocida` alimenta el toggle. Por defecto la UI filtra `conocida === true`.
- *Alternativa descartada:* mapear en el componente — se ensucia la UI y no es reutilizable entre secciones.

### D4: UI — reusar RateRow/Section, agregar toggle con MangoSelect/segmented
Las secciones nuevas usan los componentes existentes `Section` + `RateRow` + `RateLogo`. El toggle "Conocidas / Todas" sigue el sistema bespoke del proyecto (control segmentado / MangoSelect). El estado del toggle es local por sección (o uno global compartido) en el client component. No se agregan gráficos nuevos; si en el futuro se quisiera, sería con evilcharts.

### D5: API payload aditivo
`src/app/api/rendimientos/route.ts` agrega claves nuevas al objeto de respuesta (`cuentasRemuneradasUsd`, `letras`, `pfUva`, y amplía `cripto`) sin romper las existentes. Se mantiene ISR 6h y el `staleTime` de TanStack Query en el cliente.

## Risks / Trade-offs

- **El feed de ArgentinaDatos cambia de forma/keys** → toda la normalización vive en el fetcher; cada sección degrada a empty state independiente vía `allSettled`. Validar shape al integrar (los nombres exactos de campos se confirman al implementar contra la API real).
- **El mapeo de marcas queda incompleto/desactualizado** → es un mapa declarativo fácil de extender; lo no mapeado cae en "Todas" (no se pierde, solo no aparece por defecto). Riesgo aceptable.
- **Endpoint de letras sin TEA explícita** → derivar TEA desde TNA y plazo si hace falta, o mostrar solo el campo disponible; decidir al ver el shape real.
- **Más llamadas externas por request** → mitigado por ISR 6h (las llamadas se comparten entre usuarios) y `allSettled` (no bloquea por una falla).

## Open Questions

- Nombres exactos de los campos de cada endpoint nuevo de ArgentinaDatos (tasa, vencimiento, moneda) — se confirman contra la API real durante la implementación; la normalización se ajusta ahí.
- ¿El toggle "Conocidas/Todas" es por-sección o uno global para toda la página? Default propuesto: uno global, más simple de entender.
