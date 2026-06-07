import 'server-only';
import { MercadoPagoConfig, PreApproval, WebhookSignatureValidator } from 'mercadopago';
import { PREMIUM_PRICE_ARS, ANNUAL_PRICE_ARS } from '@/lib/plans';

// ---------------------------------------------------------------------------
// Singleton client — server-only, never imported from client components
// ---------------------------------------------------------------------------

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export const preApproval = new PreApproval(mpClient);

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Validates the MercadoPago webhook signature.
 * Throws if the signature is invalid.
 */
export function verifyWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null
): void {
  WebhookSignatureValidator.validate({
    xSignature: xSignature ?? undefined,
    xRequestId: xRequestId ?? undefined,
    dataId: dataId ?? undefined,
    secret: process.env.MP_WEBHOOK_SECRET!,
  });
}

// ---------------------------------------------------------------------------
// Subscription creation
// ---------------------------------------------------------------------------

export interface CreateSubscriptionPreapprovalParams {
  userId: string;
  payerEmail: string;
  interval?: 'monthly' | 'annual';
}

export type CreateSubscriptionResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.mangui.com.ar';

/**
 * Creates a MercadoPago preapproval for a monthly Premium subscription.
 * Returns sandbox_init_point in non-production environments.
 */
export async function createSubscriptionPreapproval(
  params: CreateSubscriptionPreapprovalParams
): Promise<CreateSubscriptionResult> {
  const { userId, payerEmail, interval = 'monthly' } = params;

  const isAnnual = interval === 'annual';
  const autoRecurring = isAnnual
    ? {
        frequency: 12,
        frequency_type: 'months' as const,
        transaction_amount: ANNUAL_PRICE_ARS,
        currency_id: 'ARS',
      }
    : {
        frequency: 1,
        frequency_type: 'months' as const,
        transaction_amount: PREMIUM_PRICE_ARS,
        currency_id: 'ARS',
      };
  const reason = isAnnual ? 'mangui Premium (anual)' : 'mangui Premium (mensual)';

  try {
    const response = await preApproval.create({
      body: {
        status: 'pending',
        payer_email: payerEmail,
        external_reference: userId,
        reason,
        back_url: `${APP_URL}/ajustes?sub=ok`,
        auto_recurring: autoRecurring,
      },
    });

    // Prefer sandbox_init_point outside production
    const r = response as unknown as Record<string, unknown>;
    const initPoint =
      (process.env.NODE_ENV !== 'production'
        ? (r.sandbox_init_point as string | undefined)
        : undefined) ?? (r.init_point as string | undefined);

    if (!initPoint) {
      return { ok: false, error: 'MP no devolvió un init_point para el checkout.' };
    }

    return { ok: true, initPoint };
  } catch (err: unknown) {
    const e = err as Record<string, unknown> & { cause?: unknown; message?: string; status?: unknown };
    // MP SDK v3 puts API errors in various shapes — try them all.
    let detail: string | undefined;
    if (Array.isArray(e?.cause) && e.cause.length) {
      const c = e.cause[0] as Record<string, unknown>;
      detail = (c?.description as string) ?? (c?.message as string) ?? JSON.stringify(c);
    }
    detail = detail
      ?? (typeof e?.message === 'string' ? e.message : undefined)
      ?? (e?.cause && typeof (e.cause as Record<string, unknown>).message === 'string'
          ? ((e.cause as Record<string, unknown>).message as string)
          : undefined)
      ?? (() => { try { return JSON.stringify(e).slice(0, 300); } catch { return String(e); } })();
    const status = e?.status ?? (e?.cause as Record<string, unknown>)?.status;
    console.error('[mercadopago/createSubscriptionPreapproval] error', { status, detail, err });
    return { ok: false, error: `MP: ${detail}${status ? ` (status ${status})` : ''}` };
  }
}
