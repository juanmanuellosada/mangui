import * as React from "react"
import {
  Landmark,
  Building2,
  Banknote,
  TrendingUp,
  CreditCard,
  Smartphone,
  Briefcase,
} from "lucide-react"
import type { Enums, Tables } from "@/lib/database.types"
import { LUCIDE_ICON_REGISTRY } from "@/lib/lucide-registry"

export type AccountType = Enums<"account_type">
export type Currency = Enums<"currency">
export type AccountBalance = Tables<"account_balances">
export type Account = Tables<"accounts">

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  caja_ahorro: "Caja de ahorro",
  cuenta_corriente: "Cuenta corriente",
  efectivo: "Efectivo",
  inversion: "Inversión",
  tarjeta_credito: "Tarjeta de crédito",
  billetera_virtual: "Billetera virtual",
  otro: "Otro",
}

/** Lucide icon components mapped to each account type */
export const ACCOUNT_TYPE_ICON_COMPONENTS: Record<AccountType, React.ElementType> = {
  caja_ahorro: Landmark,
  cuenta_corriente: Building2,
  efectivo: Banknote,
  inversion: TrendingUp,
  tarjeta_credito: CreditCard,
  billetera_virtual: Smartphone,
  otro: Briefcase,
}

/** Legacy emoji icons — kept for backward compat with form icon picker.
 *  The form lets users override with custom icons. */
export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  caja_ahorro: "🏦",
  cuenta_corriente: "🏛️",
  efectivo: "💵",
  inversion: "📈",
  tarjeta_credito: "💳",
  billetera_virtual: "📱",
  otro: "💼",
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  ARS: "Pesos (ARS)",
  USD: "Dólares (USD)",
}

export const ICON_OPTIONS = [
  "🏦", "🏛️", "💵", "💳", "📱", "📈", "💼", "🐷", "🎯",
  "🏠", "🚗", "✈️", "🍕", "🎮", "📚", "💰", "🔑", "⭐",
]

export const COLOR_OPTIONS = [
  "#65a30d", // lime-600 (brand)
  "#84cc16", // lime-500 (brand)
  "#f97316", // orange (accent)
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#64748b", // slate
]

/**
 * renderAccountIcon — resolves an account icon value to a React element.
 *   - URL (starts with "http" or "/"): renders a rounded <img>
 *   - "lucide:<name>": renders a Lucide icon via dynamic lookup
 *   - otherwise: renders the text/emoji in a <span>
 *
 * Pass `size` to control dimensions (default "h-5 w-5").
 */
export function renderAccountIcon(
  icon: string | null | undefined,
  opts: { size?: string; className?: string } = {}
): React.ReactElement {
  const { size = "h-5 w-5", className = "" } = opts
  if (!icon) {
    return React.createElement(Briefcase, { className: `${size} ${className}` })
  }
  if (icon.startsWith("http") || icon.startsWith("/")) {
    return React.createElement("img", {
      src: icon,
      alt: "Ícono",
      className: `${size} rounded-full object-cover ${className}`,
    })
  }
  if (icon.startsWith("lucide:")) {
    const name = icon.slice(7)
    const Comp = (LUCIDE_ICON_REGISTRY[name] as React.ElementType) ?? Briefcase
    return React.createElement(Comp, { className: `${size} ${className}` })
  }
  // Emoji or plain text
  return React.createElement(
    "span",
    { className: `text-xl leading-none select-none ${className}`, "aria-hidden": true },
    icon
  )
}
