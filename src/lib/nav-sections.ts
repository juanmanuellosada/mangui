/**
 * Shared navigation section definitions.
 * Consumed by AppSidebar (desktop) and AppBottomNav "Más" sheet (mobile).
 * Each entry carries the Lucide icon component, label, and route href.
 */

import {
  BarChart3,
  Bot,
  CreditCard,
  Home,
  PiggyBank,
  Plug,
  Repeat,
  Settings,
  Tag,
  Target,
  Wallet,
  Zap,
  ArrowLeftRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavSection {
  icon: LucideIcon;
  label: string;
  href: string;
}

/** All primary nav items — in sidebar order. */
export const PRIMARY_NAV: NavSection[] = [
  { icon: Home, label: "Inicio", href: "/app/inicio" },
  { icon: ArrowLeftRight, label: "Movimientos", href: "/app/movimientos" },
  { icon: PiggyBank, label: "Cuentas", href: "/app/cuentas" },
  { icon: Tag, label: "Categorías", href: "/app/categorias" },
  { icon: BarChart3, label: "Estadísticas", href: "/app/estadisticas" },
  { icon: CreditCard, label: "Tarjetas", href: "/app/tarjetas" },
  { icon: Repeat, label: "Recurrentes", href: "/app/recurrentes" },
  { icon: Zap, label: "Reglas", href: "/app/reglas" },
  { icon: Wallet, label: "Presupuestos", href: "/app/presupuestos" },
  { icon: Target, label: "Metas", href: "/app/metas" },
];

/** Footer / utility items — shown below the divider in the sidebar. */
export const FOOTER_NAV: NavSection[] = [
  { icon: Bot, label: "Inteligencia artificial", href: "/app/ia" },
  { icon: Plug, label: "Integraciones", href: "/app/integraciones" },
  { icon: Settings, label: "Configuración", href: "/app/ajustes" },
];

/**
 * Items shown in the bottom-nav "Más" sheet (everything that doesn't fit in the
 * 4 fixed bottom-nav slots: Inicio, Movimientos, Cuentas).
 * Includes all non-primary sections plus footer utilities.
 */
export const MORE_SHEET_NAV: NavSection[] = [
  { icon: Tag, label: "Categorías", href: "/app/categorias" },
  { icon: BarChart3, label: "Estadísticas", href: "/app/estadisticas" },
  { icon: CreditCard, label: "Tarjetas", href: "/app/tarjetas" },
  { icon: Repeat, label: "Recurrentes", href: "/app/recurrentes" },
  { icon: Zap, label: "Reglas", href: "/app/reglas" },
  { icon: Wallet, label: "Presupuestos", href: "/app/presupuestos" },
  { icon: Target, label: "Metas", href: "/app/metas" },
  { icon: Bot, label: "IA", href: "/app/ia" },
  { icon: Plug, label: "Integraciones", href: "/app/integraciones" },
  { icon: Settings, label: "Ajustes", href: "/app/ajustes" },
];
