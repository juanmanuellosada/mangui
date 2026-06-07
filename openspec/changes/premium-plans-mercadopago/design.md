## Context

Patrón de referencia: `/home/juanmanuellosada/Documentos/Proyectos/wapy/` (MP Preapproval + webhook con `WebhookSignatureValidator` + campos de billing en la entidad + `payment_exempt` + trigger de protección). Acá lo adaptamos a `profiles` (por usuario) en mangui (Next 16 + Supabase + `@supabase/ssr`). Ya existe el patrón de límite por usuario en IA (`ai_usage` + `profiles.ai_unlimited`, chequeado en `/api/ai/chat`).

## Goals / Non-Goals

**Goals:** free/premium con límites, suscripción MP mensual ARS, webhook seguro, exención manual, gating en UI + servidor, compra desde landing y sidebar.

**Non-Goals (v1):** anual (se puede sumar luego; arrancamos mensual), trial, prorrateo/cambio de plan complejo, facturación/IVA automatizada, panel de admin (la exención se hace por SQL).

## Decisions

### D1 — Campos en `profiles` (no tabla aparte)
`plan text not null default 'free'`, `payment_exempt boolean not null default false`, `payment_exempt_reason text`, `mp_preapproval_id text`, `mp_subscription_status text`, `subscription_status_changed_at timestamptz`. Trigger `prevent_billing_writes`: si `current_user <> 'service_role'` y cambian esos campos → RAISE. (El usuario nunca se auto-marca premium.)

### D2 — Entitlement
`isPremium(p) = p.payment_exempt === true || p.mp_subscription_status === 'authorized'`. El webhook setea `mp_subscription_status` y `plan` ('premium' si authorized, si no 'free'). La exención (`payment_exempt`) gana siempre.

### D3 — Límites (config central `src/lib/plans.ts`)
```
FREE = { accounts:1, budgets:1, goals:1, recurring:3, rules:0, attachments:false, exportCsv:false, aiPerDay:10 }
PREMIUM = todo Infinity/true, aiPerDay: Infinity
PREMIUM_PRICE_ARS = 9999
```
`getLimits(isPremium)`. Movimientos, cuotas, transferencias, multidólar y estadísticas: sin límite en ambos.

### D4 — Enforcement en doble capa
- **Servidor (fuerte)**: antes de cada insert que cuenta (cuentas/presupuestos/metas/recurrentes/reglas) contar las filas del usuario y rechazar si free alcanzó el límite. Idealmente en RLS o en checks server-side; mínimo en las mutations (con count) — y reglas/adjuntos/export bloqueados para free. El endpoint `/api/ai/chat` usa `aiPerDay` según plan (free 10) en vez del 30 fijo.
- **UI (UX)**: `usePlan()` (lee profile.plan/payment_exempt) → deshabilita el botón "crear" cuando se llegó al límite y muestra CTA "Mejorá a Premium". (RLS/server es el respaldo.)

### D5 — Mercado Pago (preapproval)
`src/lib/mercadopago.ts`: `MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN })`, `PreApproval`. `createSubscriptionPreapproval({ userId, payerEmail })`:
```
preApproval.create({ status:'pending', payer_email, external_reference: userId,
  reason:'mangui Premium', back_url: `${APP_URL}/ajustes?sub=ok`,
  auto_recurring:{ frequency:1, frequency_type:'months', transaction_amount:9999, currency_id:'ARS' } })
```
→ devolver `init_point` (o `sandbox_init_point` en no-prod). Server action `subscribeToPremium()` (en `src/app/actions/subscription.ts`) lo crea y devuelve el initPoint; el cliente hace `window.location.href = initPoint`.

### D6 — Webhook `/api/webhooks/mercadopago`
Verificar firma con `WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret: MP_WEBHOOK_SECRET })`. Procesar solo `subscription_preapproval`. **Re-consultar** `preApproval.get({ id: dataId })` (no confiar en el body). Por `external_reference` (= user id) actualizar `profiles` con admin client: `mp_preapproval_id`, `mp_subscription_status`, `plan` (premium si authorized), `subscription_status_changed_at` (si cambió). Idempotente. Responder 200.

### D7 — UI de compra
- **Sidebar** (`app-sidebar.tsx`): si free, CTA "Mejorá a Premium" → `/ajustes#plan` (o dispara checkout).
- **Ajustes** sección "Plan": estado actual (Free/Premium/exento), uso vs límites, botón "Suscribirme" (→ subscribeToPremium) y "Cancelar suscripción" (server action `cancelSubscription` → `preApproval.update status:'cancelled'`).
- **Landing**: sección pricing Free vs Premium ($9.999/mes), CTA Free→/register, Premium→/register (o checkout si logueado).

## Risks / Trade-offs

- [Inflación licúa el precio ARS fijo] → precio anclado a target USD; revisar `PREMIUM_PRICE_ARS` periódicamente (afecta solo nuevos suscriptores). 
- [Webhook spoofing] → verificación de firma + re-fetch a MP. 
- [Usuario intenta auto-marcarse premium] → trigger de protección (solo service_role escribe billing) + RLS. 
- [Cobro sin entrega / estados raros de MP] → re-fetch del preapproval como fuente de verdad; estados authorized/paused/cancelled. 
- [Bajar IA de 30→10 en free] → los premium/exentos quedan full; aceptable.

## Migration Plan

1. Migración (campos + trigger) + types. 
2. `plans.ts` + `mercadopago.ts` + webhook + server actions. 
3. Gating (server + UI) en los puntos de creación + IA. 
4. Sidebar + Ajustes (Plan) + Landing pricing. 
5. Ops: aplicar migración a prod, marcar juanmalosada01 `payment_exempt`, setear envs MP + registrar webhook en MP. 
- Rollback: campos aditivos; sin envs MP el checkout queda deshabilitado pero la app funciona (todos free salvo exentos).

## Open Questions
- Anual: se difiere a v2. Cancelación/grace: v1 simple (al cancelar, vuelve a free; sin grace).
