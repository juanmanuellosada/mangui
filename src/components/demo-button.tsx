"use client";

import { useState } from "react";
import { signInAsDemo } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface DemoButtonProps {
  label?: string;
  className?: string;
}

export function DemoButton({ label = "Ver demo", className }: DemoButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await signInAsDemo();
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
      window.location.assign("/login?demo=error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className={cn("cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed", className)}
    >
      {loading ? "Entrando…" : label}
    </button>
  );
}
