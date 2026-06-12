## Why

La sección "Dónde rendir" (`/rendir`) hoy muestra solo 5 categorías y, en los rankings de FCI, lista fondos mayoristas con nombres técnicos que el usuario no reconoce ("salen cosas que no conoce nadie"). Comparado con comparatasas.ar —la referencia del mercado— le faltan instrumentos clave (cuentas remuneradas en USD, letras del Tesoro, plazo fijo UVA, cripto más allá de USDT) y le falta curación por marca. El objetivo es convertir `/rendir` en un comparador de rendimientos completo y reconocible, sin perder el diferencial actual: el enfoque personalizado con la plata "idle" del usuario.

## What Changes

- **Nuevas secciones de rendimientos** (todas con datos de ArgentinaDatos, la fuente gratuita ya en uso):
  - **Cuentas Remuneradas en USD** — billeteras/cuentas que pagan sobre saldo en dólares (`/v1/finanzas/cuentas-remuneradas-usd`).
  - **LECAPs / Letras del Tesoro** — letras capitalizables (LECAP/BONCAP) con TNA/TEA y fecha de vencimiento (`/v1/finanzas/letras`).
  - **Cripto ampliado** — más allá de USDT: USDC/DAI y otras stablecoins/staking (`/v1/finanzas/rendimientos`) + criptopesos (`/v1/finanzas/criptopesos`).
  - **Plazo Fijo UVA** — plazo fijo ajustado por inflación: pago periódico y precancelable (`/v1/finanzas/tasas/plazo-fijo-uva-pago-periodico`, `/v1/finanzas/tasas/plazo-fijo-precancelable`).
- **Curación por marca**: una capa de mapeo fondo/entidad → marca de consumo conocida (Mercado Pago, Ualá, Personal Pay, Cocos, Naranja X, Prex, Lemon, etc.) con su logo. Aplica a FCI ARS, FCI USD y todo ranking por entidad. El nombre técnico del fondo pasa a subtítulo/nota.
- **Toggle "Conocidas / Todas"** por sección (default: solo conocidas), para no abrumar con fondos que nadie reconoce pero sin ocultarlos del todo.
- **Se mantiene** el hero personalizado (plata idle + proyección de ganancia mensual por instrumento) y el `RendirNudge` del dashboard; las secciones nuevas se integran en el mismo patrón visual (RateRow/Section).
- Fuera de alcance (se evaluarán aparte por requerir otra fuente): **Cauciones** y **Créditos Hipotecarios UVA**.

## Capabilities

### New Capabilities
- `rendimientos-comparador`: comparador de rendimientos de instrumentos financieros argentinos (ARS y USD) con datos de ArgentinaDatos, curación por marca conocida, toggle conocidas/todas, y vista personalizada según la plata disponible del usuario.

### Modified Capabilities
<!-- Ninguna: no existe spec previa de rendir; la lógica actual se absorbe en la nueva capability. -->

## Impact

- **Código:**
  - `src/lib/rendimientos/argentinadatos.ts` — nuevos endpoints, tipos y normalización (TNA/TEA, vencimiento de letras, UVA, cripto).
  - Nuevo módulo de mapeo fondo/entidad → marca/logo (p. ej. `src/lib/rendimientos/marcas.ts`).
  - `src/app/api/rendimientos/route.ts` — ampliar el payload con las nuevas secciones.
  - `src/components/rendir/rendir-view.tsx` — nuevas secciones, toggle conocidas/todas, render de TNA/TEA/vencimiento.
- **Datos:** ArgentinaDatos (público, sin auth, sin cambios de credenciales). Se reutiliza el set de logos de fintech AR en `public/icons/`.
- **Sin cambios** en Supabase, migraciones, ni en la detección de plata idle (vista `account_balances`).
- **Caching:** se mantiene la estrategia ISR 6h en la API + TanStack Query en el cliente.
