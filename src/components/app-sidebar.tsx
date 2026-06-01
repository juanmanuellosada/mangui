"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  Home,
  PiggyBank,
  Settings,
  PlusCircle,
  LogOut,
  ArrowLeftRight,
  Repeat,
  CalendarClock,
  Zap,
  Wallet,
  Target,
  Plug,
  Bot,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/components/quick-add-provider";

const navItems = [
  { icon: Home, label: "Inicio", href: "/app/dashboard" },
  { icon: ArrowLeftRight, label: "Movimientos", href: "/app/movements" },
  { icon: PiggyBank, label: "Cuentas", href: "/app/accounts" },
  { icon: BarChart3, label: "Estadísticas", href: "/app/stats" },
  { icon: CreditCard, label: "Tarjetas", href: "/app/cards" },
  { icon: Repeat, label: "Recurrentes", href: "/app/recurrentes" },
  { icon: CalendarClock, label: "Programadas", href: "/app/programadas" },
  { icon: Zap, label: "Reglas", href: "/app/reglas" },
  { icon: Wallet, label: "Presupuestos", href: "/app/presupuestos" },
  { icon: Target, label: "Metas", href: "/app/metas" },
];

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

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar z-30 shadow-sm">
      {/* Brand */}
      <div className="flex items-center px-5 h-16 border-b border-sidebar-border">
        <Link href="/app/dashboard" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
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

      {/* Footer: settings + user + logout */}
      <div className="p-3 space-y-0.5 pb-4">
        <Link
          href="/app/ia"
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname === "/app/ia" &&
              "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          )}
        >
          <Bot className="h-4 w-4 text-sidebar-foreground/70 flex-shrink-0" />
          Inteligencia artificial
        </Link>
        <Link
          href="/app/integraciones"
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname === "/app/integraciones" &&
              "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          )}
        >
          <Plug className="h-4 w-4 text-sidebar-foreground/70 flex-shrink-0" />
          Integraciones
        </Link>
        <Link
          href="/app/settings"
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname === "/app/settings" &&
              "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          )}
        >
          <Settings className="h-4 w-4 text-sidebar-foreground/70 flex-shrink-0" />
          Configuración
        </Link>

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
