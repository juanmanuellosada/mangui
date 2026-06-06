"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAsDemo } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface DemoButtonProps {
  label?: string;
  className?: string;
}

export function DemoButton({ label = "Ver demo", className }: DemoButtonProps) {
  const router = useRouter();
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
        router.push("/inicio");
        router.refresh();
      } else {
        router.push("/login?demo=error");
      }
    } catch {
      router.push("/login?demo=error");
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
