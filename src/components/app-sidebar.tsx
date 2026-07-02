"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { usePathname } from "next/navigation";
import {
  PlusCircle,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/components/quick-add-provider";
import { PRIMARY_NAV, FOOTER_NAV } from "@/lib/nav-sections";
import { usePlan } from "@/lib/use-plan";
import { track } from "@/lib/analytics";

const navItems = PRIMARY_NAV;

interface AppSidebarProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * Desktop sidebar — persistent left, hidden on mobile (lg:flex).
 * Active state determined by usePathname.
 */
export function AppSidebar({ name, email, avatarUrl }: AppSidebarProps) {
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const { isPremium: userIsPremium, isLoading: planLoading } = usePlan();
  const showUpgradeCta = !planLoading && !userIsPremium;

  useEffect(() => {
    if (showUpgradeCta) track("paywall_shown", { feature: "sidebar", placement: "sidebar" });
  }, [showUpgradeCta]);

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar z-30 shadow-sm">
      {/* Brand */}
      <div className="flex items-center px-5 h-16 border-b border-sidebar-border">
        <Link href="/inicio" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          <BrandLockup size={28} />
        </Link>
      </div>

      {/* Quick add */}
      <div className="px-4 pt-5">
        <button
          type="button"
          onClick={() => quickAdd.open()}
          className="w-full gap-2 justify-center font-semibold shadow-sm shadow-primary/20 press-effect inline-flex h-8 shrink-0 items-center rounded-lg border border-transparent bg-primary px-2.5 text-sm text-primary-foreground transition-all hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo movimiento
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-5 space-y-0.5" aria-label="Navegación principal">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-sidebar-border" />

      {/* Premium CTA — shown only for free users */}
      {showUpgradeCta && (
        <div className="px-4 pt-3">
          <Link
            href="/ajustes#plan"
            onClick={() => track("upgrade_click", { feature: "sidebar", placement: "sidebar" })}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 press-effect",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "bg-gradient-to-r from-primary/15 to-accent/10 border border-primary/20",
              "text-primary hover:from-primary/20 hover:to-accent/15 hover:border-primary/35"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>Mejorá a Premium</span>
          </Link>
        </div>
      )}

      {/* Footer: settings + user + logout */}
      <div className="p-3 space-y-0.5 pb-4">
        {FOOTER_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pathname === item.href &&
                "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            )}
          >
            <item.icon className="h-4 w-4 text-sidebar-foreground/70 flex-shrink-0" />
            {item.label}
          </Link>
        ))}

        {/* User card */}
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl">
          <Avatar className="h-8 w-8 flex-shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "cursor-pointer"
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
