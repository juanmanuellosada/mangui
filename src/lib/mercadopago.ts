import 'server-only';
import { MercadoPagoConfig, PreApproval, WebhookSignatureValidator } from 'mercadopago';
import { PREMIUM_PRICE_ARS } from '@/lib/plans';

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
  const { userId, payerEmail } = params;

  try {
    const response = await preApproval.create({
      body: {
        status: 'pending',
        payer_email: payerEmail,
        external_reference: userId,
        reason: 'mangui Premium',
        back_url: `${APP_URL}/ajustes?sub=ok`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: PREMIUM_PRICE_ARS,
          currency_id: 'ARS',
        },
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
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al crear la suscripción en MercadoPago.';
    console.error('[mercadopago/createSubscriptionPreapproval] error', { err });
    return { ok: false, error: message };
  }
}
