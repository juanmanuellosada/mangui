export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { preApproval, verifyWebhookSignature } from '@/lib/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// POST /api/webhooks/mercadopago
//
// Receives MercadoPago subscription notifications.
// - Always verifies the webhook signature before processing.
// - Only processes subscription_preapproval notifications.
// - Re-fetches the preapproval from MP (never trusts the webhook body for status).
// - Updates profiles via the admin client (service_role bypasses trigger + RLS).
// - Idempotent: advances subscription_status_changed_at only when status changes.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- 1. Validate webhook signature ---
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  // data.id can arrive as a query param (standard) or inside the body
  const url = new URL(req.url);
  const dataIdFromQuery = url.searchParams.get('data.id');

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body may not be JSON — treat as empty
  }

  const dataIdFromBody =
    typeof body?.data === 'object' && body.data !== null
      ? String((body.data as Record<string, unknown>).id ?? '')
      : typeof body?.id === 'string' || typeof body?.id === 'number'
        ? String(body.id)
        : null;

  const dataId = dataIdFromQuery ?? dataIdFromBody;

  try {
    verifyWebhookSignature(xSignature, xRequestId, dataId);
  } catch {
    console.error('[webhook/mercadopago] Invalid signature', { xRequestId });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // --- 2. Identify the notification type ---
  // Only subscription_preapproval events carry a preapproval ID we can re-fetch.
  const notificationType =
    typeof body?.type === 'string' ? body.type : null;
  const notificationAction =
    typeof body?.action === 'string' ? body.action : null;

  if (notificationType !== null && notificationType !== 'subscription_preapproval') {
    console.info('[webhook/mercadopago] Ignored notification type', {
      type: notificationType,
      action: notificationAction,
      xRequestId,
    });
    return NextResponse.json({ ok: true });
  }

  if (!dataId) {
    console.warn('[webhook/mercadopago] Missing data.id — acking without write', {
      type: notificationType,
      xRequestId,
    });
    return NextResponse.json({ ok: true });
  }

  // --- 3. Re-fetch the preapproval from MP (never trust the webhook body) ---
  let preapprovalData: {
    id?: string | null;
    status?: string | null;
    external_reference?: string | null;
  };
  try {
    preapprovalData = await preApproval.get({ id: dataId });
  } catch (err) {
    console.error('[webhook/mercadopago] Failed to fetch preapproval from MP', {
      dataId,
      err,
    });
    return NextResponse.json({ error: 'Failed to fetch preapproval' }, { status: 502 });
  }

  const preapprovalId = preapprovalData?.id ?? null;
  const mpStatus = preapprovalData?.status ?? null;
  const userId = preapprovalData?.external_reference ?? null;

  if (!userId) {
    console.warn('[webhook/mercadopago] No external_reference on preapproval', {
      preapprovalId,
      mpStatus,
      xRequestId,
    });
    return NextResponse.json({ ok: true });
  }

  // --- 4. Idempotent update on profiles ---
  const admin = createAdminClient();
  if (!admin) {
    console.error('[webhook/mercadopago] Admin client unavailable');
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  }

  const { data: currentProfile, error: fetchError } = await admin
    .from('profiles')
    .select('mp_subscription_status, mp_preapproval_id')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[webhook/mercadopago] Error reading profile', { userId, fetchError });
    return NextResponse.json({ error: 'DB read error' }, { status: 500 });
  }

  if (!currentProfile) {
    console.warn('[webhook/mercadopago] Profile not found for external_reference', {
      userId,
      preapprovalId,
    });
    return NextResponse.json({ ok: true });
  }

  const statusChanged = currentProfile.mp_subscription_status !== mpStatus;
  const now = new Date().toISOString();
  const newPlan = mpStatus === 'authorized' ? 'premium' : 'free';

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      mp_preapproval_id: preapprovalId,
      mp_subscription_status: mpStatus,
      plan: newPlan,
      ...(statusChanged ? { subscription_status_changed_at: now } : {}),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[webhook/mercadopago] Error updating profile', { userId, updateError });
    return NextResponse.json({ error: 'DB update error' }, { status: 500 });
  }

  console.info('[webhook/mercadopago] Profile updated', {
    userId,
    preapprovalId,
    mpStatus,
    newPlan,
    statusChanged,
    xRequestId,
  });

  return NextResponse.json({ ok: true });
}
