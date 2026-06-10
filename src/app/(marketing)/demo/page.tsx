"use client";

import { useEffect } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { signInAsDemo } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

export default function DemoPage() {
  useEffect(() => {
    let cancelled = false;

    async function login() {
      try {
        const res = await signInAsDemo();
        if (cancelled) return;
        if (res.ok) {
          const supabase = createClient();
          await supabase.auth.setSession({
            access_token: res.access_token,
            refresh_token: res.refresh_token,
          });
          window.location.assign("/inicio");
        } else {
          window.location.assign("/login?demo=error");
        }
      } catch {
        if (!cancelled) window.location.assign("/login?demo=error");
      }
    }

    login();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-6">
      <BrandLockup size={36} />
      <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
        <span
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
        Entrando al demo…
      </div>
    </div>
  );
}
