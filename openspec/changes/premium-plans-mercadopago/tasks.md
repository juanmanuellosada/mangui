## 1. Datos + entitlement + MP backend (Fase 1)

- [x] 1.1 Migración: agregar a `profiles` → `plan text not null default 'free'`, `payment_exempt boolean not null default false`, `payment_exempt_reason text`, `mp_preapproval_id text`, `mp_subscription_status text`, `subscription_status_changed_at timestamptz`. Trigger `prevent_billing_writes` (solo `service_role` puede cambiar esos campos). Actualizar `database.types.ts`.
- [x] 1.2 `src/lib/plans.ts`: `PLAN_LIMITS` (free vs premium, según diseño), `PREMIUM_PRICE_ARS=9999`, `isPremium(profile)`, `getLimits(isPremium)`.
- [x] 1.3 `src/lib/mercadopago.ts`: cliente MP (`MP_ACCESS_TOKEN`) + `createSubscriptionPreapproval({ userId, payerEmail })` (mensual ARS 9999) → init_point (sandbox en no-prod).
- [x] 1.4 `src/app/actions/subscription.ts`: `subscribeToPremium()` (crea preapproval, devuelve initPoint) y `cancelSubscription()` (preApproval.update cancelled).
- [x] 1.5 `src/app/api/webhooks/mercadopago/route.ts`: verificar firma (`WebhookSignatureValidator` + `MP_WEBHOOK_SECRET`), procesar `subscription_preapproval`, re-consultar `preApproval.get`, actualizar `profiles` por `external_reference` (user id) con admin client. Idempotente.
- [x] 1.6 `.env.example`: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`.

## 2. Gating (Fase 2)

- [x] 2.1 `usePlan()` hook (lee profile.plan/payment_exempt → isPremium + límites). Incluir `plan` en el fetch del layout.
- [x] 2.2 Enforcement en creación (server + UI) con límites free: cuentas (1), presupuestos (1), metas (1), recurrentes (3). Botón "crear" deshabilitado al límite + CTA premium.
- [x] 2.3 Reglas automáticas, adjuntos y export CSV: bloqueados en free (UI + server) con CTA premium.
- [x] 2.4 `/api/ai/chat`: usar `aiPerDay` por plan (free 10) en vez del 30 fijo; premium/exento sin tope.

## 3. UI de compra (Fase 3)

- [x] 3.1 Sidebar: CTA "Mejorá a Premium" si free.
- [x] 3.2 Ajustes: sección "Plan" (estado free/premium/exento, uso vs límites, Suscribirme / Cancelar).
- [x] 3.3 Landing: sección de precios (Free vs Premium $9.999/mes) con CTAs.

## 4. Verificación + Ops

- [x] 4.1 `tsc --noEmit` + `next build`.
- [ ] 4.2 Ops (usuario): setear `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en Vercel; registrar la URL del webhook en el panel de Mercado Pago.
- [x] 4.3 Ops: aplicar migración a prod y marcar `juanmalosada01@gmail.com` con `payment_exempt=true`.
- [ ] 4.4 QA: suscripción end-to-end (checkout → webhook → premium), gating en free, exención.
