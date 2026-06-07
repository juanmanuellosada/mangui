"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInAsDemo(): Promise<
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false }
> {
  // Intentional public read-only demo credentials — not a secret.
  // The demo account is RLS-enforced read-only; "Ver demo" exposes these
  // to every visitor anyway. Hardcoding avoids stale env-var failures.
  const email = "demo.mangui@gmail.com";
  const password = "demo123";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return { ok: false };
  }

  return {
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}
