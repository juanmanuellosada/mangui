"use client";

import { useRouter, usePathname } from "next/navigation";
import { useIsDemo } from "@/lib/use-is-demo";

/**
 * Manguito FAB — mobile-only floating action button that opens the AI chat.
 *
 * Visibility rules:
 * - Mobile only (lg:hidden) — desktop sidebar already has the Manguito link.
 * - Hidden on /ia itself (redundant).
 * - Hidden for demo users (AI chat is blocked there).
 * - Hidden while is_demo is loading (data ?? false → false, so this is implicit).
 */
export function ManguitoFab() {
  const router = useRouter();
  const pathname = usePathname();
  const isDemo = useIsDemo();

  // Don't render on the AI page itself, or for demo users.
  if (pathname === "/ia" || isDemo) return null;

  return (
    <button
      type="button"
      aria-label="Abrir Manguito (asistente IA)"
      onClick={() => router.push("/ia")}
      className={[
        // Mobile only
        "lg:hidden",
        // Position: fixed, bottom-right, above the bottom nav (~64px) + safe area
        "fixed right-4 z-50",
        // bottom-24 ≈ 96px clears the 64px nav + some breathing room; pb-safe adds env(safe-area-inset-bottom)
        "bottom-24",
        // Size
        "w-14 h-14 rounded-full",
        // Gradient: lime (primary) → orange (accent)
        "bg-gradient-to-br from-primary to-accent",
        // Shadow
        "shadow-lg shadow-primary/30",
        // Flex center for the image
        "flex items-center justify-center",
        // Press/scale interaction (150ms, ease-out)
        "transition-transform duration-150 ease-out",
        "active:scale-90 hover:scale-105",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        // Entrance animation
        "animate-fab-in",
      ].join(" ")}
    >
      {/* Logo image — use existing /logo-square.png, slightly inset for padding */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-square.png"
        alt=""
        aria-hidden="true"
        width={34}
        height={34}
        className="rounded-full object-contain drop-shadow-sm"
        draggable={false}
      />
    </button>
  );
}
