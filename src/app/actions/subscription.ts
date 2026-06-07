'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { preApproval, createSubscriptionPreapproval } from '@/lib/mercadopago';
import { isPremium } from '@/lib/plans';

// ---------------------------------------------------------------------------
// subscribeToPremium
//
// Creates a MercadoPago hosted-checkout preapproval (status: "pending") and
// returns the init_point URL for the client to redirect to.
// The plan is NOT set here — the webhook sets it once MP authorizes payment.
// ---------------------------------------------------------------------------

export async function subscribeToPremium(
  interval: 'monthly' | 'annual' = 'monthly'
): Promise<{ ok: true; initPoint: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'No autenticado.' };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: 'Servicio no disponible. Contactá soporte.' };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('payment_exempt, mp_subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && isPremium(profile)) {
    return { ok: false, error: 'Ya tenés una suscripción Premium activa.' };
  }

  return createSubscriptionPreapproval({
    userId: user.id,
    payerEmail: user.email ?? '',
    interval,
  });
}

// ---------------------------------------------------------------------------
// cancelSubscription
//
// Cancels the user's active MercadoPago preapproval.
// The actual status change is reflected once the webhook arrives.
// ---------------------------------------------------------------------------

export async function cancelSubscription(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'No autenticado.' };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: 'Servicio no disponible. Contactá soporte.' };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('mp_preapproval_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.mp_preapproval_id) {
    return { ok: false, error: 'No hay suscripción activa para cancelar.' };
  }

  try {
    await preApproval.update({
      id: profile.mp_preapproval_id,
      body: { status: 'cancelled' },
    });
  } catch (err) {
    console.error('[subscription/cancelSubscription] MP error', { err });
    return { ok: false, error: 'No se pudo cancelar la suscripción. Intentá de nuevo.' };
  }

  return { ok: true };
}
