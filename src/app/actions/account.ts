'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getIsDemo } from '@/lib/demo';
import { preApproval } from '@/lib/mercadopago';

const STORAGE_BUCKETS = ['attachments', 'icons'] as const;

// ---------------------------------------------------------------------------
// deleteAccount
//
// Hard-deletes the authenticated user's account, all their data, and their
// Storage files. If a MercadoPago subscription exists, it is cancelled first.
//
// Cascade RESTRICT fix: movements, transfers and installment_purchases all
// have account_id REFERENCES accounts(id) ON DELETE RESTRICT.  Both tables
// also have user_id REFERENCES auth.users(id) ON DELETE CASCADE, so we delete
// them explicitly by user_id before calling deleteUser — ensuring that by the
// time Postgres cascades the accounts deletion there are no RESTRICT referrers
// left, and the cascade completes without violating FK constraints.
// ---------------------------------------------------------------------------

export async function deleteAccount(
  confirmation: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Server-side confirmation guard
  if (confirmation !== 'ELIMINAR') {
    return { ok: false, error: 'Confirmación incorrecta.' };
  }

  // 2. Get authenticated user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: 'No autenticado.' };
  }

  // 3. Block demo account
  const isDemo = await getIsDemo();
  if (isDemo) {
    return { ok: false, error: 'La cuenta demo no puede eliminarse.' };
  }

  // 4. Admin client required
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: 'Servicio no disponible. Intentá de nuevo más tarde.' };
  }

  const userId = user.id;

  // 5. Cancel MercadoPago subscription if active — ABORT on failure
  const { data: profile } = await admin
    .from('profiles')
    .select('mp_preapproval_id')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.mp_preapproval_id) {
    try {
      await preApproval.update({
        id: profile.mp_preapproval_id,
        body: { status: 'cancelled' },
      });
    } catch (err) {
      console.error('[account/deleteAccount] MP cancellation error', { err });
      return {
        ok: false,
        error: 'No se pudo cancelar la suscripción de MercadoPago. Tu cuenta no fue eliminada. Intentá de nuevo o contactá soporte.',
      };
    }
  }

  // 6. Purge Storage files (best-effort — a Storage orphan is tolerable)
  for (const bucket of STORAGE_BUCKETS) {
    try {
      // list() paginates at 100 by default; loop until empty
      let offset = 0;
      const pageSize = 100;
      while (true) {
        const { data: files, error: listErr } = await admin.storage
          .from(bucket)
          .list(userId, { limit: pageSize, offset });

        if (listErr) {
          console.error(`[account/deleteAccount] Storage list error (${bucket})`, { listErr });
          break;
        }
        if (!files || files.length === 0) break;

        const paths = files.map((f) => `${userId}/${f.name}`);
        const { error: removeErr } = await admin.storage.from(bucket).remove(paths);
        if (removeErr) {
          console.error(`[account/deleteAccount] Storage remove error (${bucket})`, { removeErr });
        }

        if (files.length < pageSize) break;
        offset += pageSize;
      }
    } catch (err) {
      console.error(`[account/deleteAccount] Unexpected Storage error (${bucket})`, { err });
    }
  }

  // 7. Pre-delete rows protected by ON DELETE RESTRICT on accounts(id)
  //    Order: movements and installment_purchases first (they don't depend on
  //    each other), then transfers.
  const restrictTables = ['movements', 'installment_purchases', 'transfers'] as const;
  for (const table of restrictTables) {
    const { error: delErr } = await admin
      .from(table)
      .delete()
      .eq('user_id', userId);

    if (delErr) {
      console.error(`[account/deleteAccount] Failed to pre-delete ${table}`, { delErr });
      return {
        ok: false,
        error: `Error interno al eliminar datos (${table}). Tu cuenta no fue eliminada. Contactá soporte.`,
      };
    }
  }

  // 8. Delete the auth user — cascades all remaining FK ON DELETE CASCADE tables
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserErr) {
    console.error('[account/deleteAccount] deleteUser error', { deleteUserErr });
    return {
      ok: false,
      error: 'No se pudo eliminar la cuenta. Contactá soporte.',
    };
  }

  // 9. Sign out (best-effort — user no longer exists so this may fail silently)
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  return { ok: true };
}
