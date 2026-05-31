"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, PiggyBank, PlusCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Inicio", href: "/app/dashboard" },
  { icon: PiggyBank, label: "Cuentas", href: "/app/accounts" },
  { icon: PlusCircle, label: "Nuevo", href: "/app/movements", isAction: true },
  { icon: BarChart3, label: "Stats", href: "/app/stats" },
  { icon: Settings, label: "Más", href: "/app/settings" },
];

/**
 * Mobile bottom navigation bar — visible only on small/medium screens (lg:hidden).
 * Uses usePathname for active state.
 */
export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass bg-background/85 border-t border-border/60 pb-safe"
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = !item.isAction && pathname === item.href;

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-5 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/35 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Movimientos"
              >
                <item.icon className="h-6 w-6" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-all duration-150",
                  isActive && "scale-110"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
