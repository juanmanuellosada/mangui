## Why

mangui necesita monetizarse: un plan **free** (registro gratis, con límites) y un plan **premium** que desbloquea todo, cobrado por **suscripción mensual vía Mercado Pago** (mercado AR). Además se necesita marcar manualmente usuarios como premium sin que paguen (dueño + amigos).

## What Changes

- **Modelo de planes** en `profiles`: `plan` ('free'|'premium'), `payment_exempt` (premium sin pagar) + `payment_exempt_reason`, y campos de billing de MP (`mp_preapproval_id`, `mp_subscription_status`, `subscription_status_changed_at`). Trigger que impide a usuarios escribir esos campos (solo `service_role`).
- **Entitlement**: helper `isPremium(profile) = payment_exempt || mp_subscription_status === 'authorized'`.
- **Integración Mercado Pago (suscripción/preapproval)**: `src/lib/mercadopago.ts` (`createSubscriptionPreapproval`), server action para iniciar checkout (redirect a `init_point`), y webhook `/api/webhooks/mercadopago` (verifica firma, re-consulta a MP, actualiza el plan). Precio premium = **ARS $9.999/mes** (anclado ~US$7).
- **Límites del plan free** (premium = todo ilimitado): 1 cuenta, 1 presupuesto, 1 meta, 3 recurrentes, IA Manguito 10/día, **sin** reglas automáticas, **sin** adjuntos, **sin** export CSV. Movimientos, cuotas, transferencias, multidólar y estadísticas quedan ilimitados en free.
- **Gating**: helper central de límites + enforcement en los puntos de creación (cuentas/presupuestos/metas/recurrentes/reglas/adjuntos/export) y en el endpoint de IA; UI con CTA "Mejorá a Premium".
- **Sidebar**: CTA "Mejorá a Premium" (si es free) → checkout/plan.
- **Ajustes**: sección "Plan" con estado, suscribir/cancelar y uso vs límites.
- **Landing**: sección de precios (Free vs Premium $9.999).
- **Ops**: aplicar migración a prod, marcar `juanmalosada01@gmail.com` como `payment_exempt=true`, setear `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` en Vercel y registrar el webhook en MP.

## Capabilities

### New Capabilities
- `subscription-plans`: planes free/premium con límites, entitlement, suscripción Mercado Pago (preapproval + webhook), flag de exención manual, y gating de features.

## Impact

- **Datos**: nueva migración (campos de plan/billing en `profiles` + trigger de protección). `database.types.ts`.
- **Lib**: `src/lib/plans.ts` (límites + isPremium), `src/lib/mercadopago.ts`.
- **API**: `src/app/api/webhooks/mercadopago/route.ts`. Server action de suscripción (`src/app/actions/subscription.ts`).
- **UI**: enforcement en accounts/budgets/goals/recurring/rules/attachments/export; `app-sidebar.tsx` (CTA); `ajustes` (sección Plan); `src/app/(marketing)/page.tsx` (pricing). Endpoint IA (`/api/ai/chat`) free=10/día.
- **Env/Ops**: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` (Vercel), webhook en MP, exención de juanmalosada01.
