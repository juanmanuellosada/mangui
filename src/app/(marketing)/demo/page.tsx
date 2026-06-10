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

  // BrandLockup lays out [mascot | gap | wordmark]. Its horizontal center is
  // shifted left of the wordmark center by (mascotW + gap) / 2. Shift the
  // spinner column right by that same amount so it sits under the wordmark.
  const SIZE = 36;
  const markH = Math.round(SIZE * 1.45);
  const markW = Math.round(markH * (256 / 256)); // mascot is square
  const gap   = Math.round(SIZE * 0.35);
  const spinnerOffset = (markW + gap) / 2;

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-6">
      <BrandLockup size={SIZE} />
      <div
        className="flex flex-col items-center gap-2 text-muted-foreground text-sm"
        style={{ transform: `translateX(${spinnerOffset}px)` }}
      >
        <span
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
        Entrando al demo…
      </div>
    </div>
  );
}
