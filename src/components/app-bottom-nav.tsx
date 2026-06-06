"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PiggyBank, ArrowLeftRight, LayoutGrid, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/components/quick-add-provider";
import { MangoSheet } from "@/components/ui/mango-sheet";
import { MORE_SHEET_NAV } from "@/lib/nav-sections";
import React from "react";

const BOTTOM_NAV = [
  { icon: Home, label: "Inicio", href: "/inicio" },
  { icon: ArrowLeftRight, label: "Movimientos", href: "/movimientos" },
  null, // center slot — replaced by the "+" quick-add button
  { icon: PiggyBank, label: "Cuentas", href: "/cuentas" },
];

/**
 * Mobile bottom navigation bar — visible only on small/medium screens (lg:hidden).
 * Glass effect, safe-area aware, active state with lime indicator dot + bold label.
 * "Más" opens a MangoSheet with all sections that don't fit in the 4 fixed slots.
 */
export function AppBottomNav() {
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // "Más" is considered active when the current path matches any item in the sheet.
  const moreIsActive =
    !BOTTOM_NAV.some(
      (item) => item !== null && (pathname === item.href || pathname.startsWith(item.href + "/"))
    ) && pathname !== "/inicio";

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass bg-background/85 border-t border-border/60 pb-safe"
        aria-label="Navegación principal"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {BOTTOM_NAV.map((item, index) => {
            // Center slot: quick-add button
            if (item === null) {
              return (
                <button
                  key="quick-add"
                  type="button"
                  onClick={() => quickAdd.open()}
                  aria-label="Nuevo movimiento"
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 min-w-0",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PlusCircle className="h-5 w-5 transition-transform duration-150" />
                  <span className="text-[10px] font-medium leading-none">Nuevo</span>
                </button>
              );
            }

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

          {/* "Más" button — opens the sheet */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Ver más secciones"
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 min-w-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              moreIsActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid
              className={cn(
                "h-5 w-5 transition-transform duration-150",
                moreIsActive && "scale-110"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium leading-none",
                moreIsActive && "font-bold"
              )}
            >
              Más
            </span>
            {moreIsActive && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary"
              />
            )}
          </button>
        </div>
      </nav>

      <MangoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Secciones"
      >
        <div className="grid grid-cols-3 gap-2">
          {MORE_SHEET_NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSheetOpen(false)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl py-4 px-2 min-h-[72px]",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-foreground hover:bg-muted"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span className={cn("text-xs font-medium text-center leading-tight", isActive && "font-semibold")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </MangoSheet>
    </>
  );
}
