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
  TrendingUp,
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
  { icon: Home, label: "Inicio", href: "/inicio" },
  { icon: ArrowLeftRight, label: "Movimientos", href: "/movimientos" },
  { icon: PiggyBank, label: "Cuentas", href: "/cuentas" },
  { icon: Tag, label: "Categorías", href: "/categorias" },
  { icon: BarChart3, label: "Estadísticas", href: "/estadisticas" },
  { icon: CreditCard, label: "Tarjetas", href: "/tarjetas" },
  { icon: Repeat, label: "Recurrentes", href: "/recurrentes" },
  { icon: Zap, label: "Reglas", href: "/reglas" },
  { icon: Wallet, label: "Presupuestos", href: "/presupuestos" },
  { icon: Target, label: "Metas", href: "/metas" },
  { icon: TrendingUp, label: "Dónde rendir", href: "/rendir" },
];

/** Footer / utility items — shown below the divider in the sidebar. */
export const FOOTER_NAV: NavSection[] = [
  { icon: Bot, label: "Inteligencia artificial", href: "/ia" },
  { icon: Plug, label: "Integraciones", href: "/integraciones" },
  { icon: Settings, label: "Configuración", href: "/ajustes" },
];

/**
 * Items shown in the bottom-nav "Más" sheet (everything that doesn't fit in the
 * 4 fixed bottom-nav slots: Inicio, Movimientos, Cuentas).
 * Includes all non-primary sections plus footer utilities.
 */
export const MORE_SHEET_NAV: NavSection[] = [
  { icon: Tag, label: "Categorías", href: "/categorias" },
  { icon: BarChart3, label: "Estadísticas", href: "/estadisticas" },
  { icon: CreditCard, label: "Tarjetas", href: "/tarjetas" },
  { icon: Repeat, label: "Recurrentes", href: "/recurrentes" },
  { icon: Zap, label: "Reglas", href: "/reglas" },
  { icon: Wallet, label: "Presupuestos", href: "/presupuestos" },
  { icon: Target, label: "Metas", href: "/metas" },
  { icon: TrendingUp, label: "Dónde rendir", href: "/rendir" },
  { icon: Bot, label: "IA", href: "/ia" },
  { icon: Plug, label: "Integraciones", href: "/integraciones" },
  { icon: Settings, label: "Ajustes", href: "/ajustes" },
];
