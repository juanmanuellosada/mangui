# E2E tests (Playwright)

## Correr los smokes de lectura

No mutan datos, corren contra prod por default (`E2E_BASE_URL`, default
`https://www.mangui.com.ar`). Usan la cuenta demo (`demo.mangui@gmail.com`),
que es read-only por RLS.

```bash
npx playwright install chromium   # una vez
npm run e2e -- e2e/smoke.spec.ts
```

Contra otro entorno:

```bash
E2E_BASE_URL=http://localhost:3000 npm run e2e -- e2e/smoke.spec.ts
```

## Correr los flujos de escritura

`e2e/flows.spec.ts` cubre login, alta de movimiento, transferencia, compra en
cuotas y comportamiento offline. Están **gateados**: si no están seteadas
`E2E_EMAIL` / `E2E_PASSWORD` se skipean enteros (no corren en CI por
default).

Qué falta para habilitarlos (decisión de infra pendiente del dueño del
proyecto):

- Un **usuario de test dedicado** con permisos de escritura reales — la
  cuenta demo no sirve, es read-only por RLS. Puede ser un usuario Supabase
  normal creado a mano en un backend de test.
- Preferentemente, no correrlos contra prod: usar un **Supabase local**
  (`supabase start`) o un **branch de Supabase** aislado, para no ensuciar
  datos reales.
- Al menos dos cuentas cargadas en ese usuario (una de ellas tarjeta de
  crédito) para que los tests de transferencia y cuotas tengan algo para
  seleccionar.

Una vez exista ese usuario:

```bash
E2E_BASE_URL=<url del backend de test> \
E2E_EMAIL=test@example.com \
E2E_PASSWORD=<password> \
npm run e2e -- e2e/flows.spec.ts
```

Nota: los selectores de los combos de cuenta/categoría (`MangoSelect`) en
`e2e/flows.spec.ts` asumen el patrón habitual de Radix Select
(`role="combobox"` + `role="option"`). No se pudieron verificar en runtime
porque no hay entorno de escritura disponible todavía — revisar y ajustar al
habilitarlos por primera vez.

## CI

Los smokes de lectura tienen un workflow separado
(`.github/workflows/e2e.yml`), disparado manualmente (`workflow_dispatch`) —
no corren en cada push porque dependen de red y de prod. El gate principal de
CI (`ci.yml`: lint + typecheck + test) no incluye e2e.
