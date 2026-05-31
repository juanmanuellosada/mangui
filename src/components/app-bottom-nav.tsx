"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, PiggyBank, ArrowLeftRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Inicio", href: "/app/dashboard" },
  { icon: ArrowLeftRight, label: "Movimientos", href: "/app/movements" },
  { icon: PiggyBank, label: "Cuentas", href: "/app/accounts" },
  { icon: BarChart3, label: "Stats", href: "/app/stats" },
  { icon: Settings, label: "Más", href: "/app/settings" },
];

/**
 * Mobile bottom navigation bar — visible only on small/medium screens (lg:hidden).
 * Glass effect, safe-area aware, active state with lime indicator dot + bold label.
 */
export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass bg-background/85 border-t border-border/60 pb-safe"
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 min-w-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-transform duration-150",
                  isActive && "scale-110"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  isActive && "font-bold"
                )}
              >
                {item.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
