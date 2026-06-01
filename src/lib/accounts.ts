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

/** Emoji glyphs used in the account form type selector tiles */
export const ACCOUNT_TYPE_EMOJIS: Record<AccountType, string> = {
  caja_ahorro: "🏦",
  cuenta_corriente: "💼",
  efectivo: "💵",
  inversion: "📈",
  tarjeta_credito: "💳",
  billetera_virtual: "📱",
  otro: "🏷️",
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
  opts: { size?: string; className?: string; logoFill?: boolean } = {}
): React.ReactElement {
  const { size = "h-5 w-5", className = "", logoFill = false } = opts
  if (!icon) {
    return React.createElement(Briefcase, { className: `${size} ${className}` })
  }
  if (icon.startsWith("http") || icon.startsWith("/")) {
    // logoFill: fills the parent container (use when parent is a clipping rounded square)
    const imgClass = logoFill
      ? `w-full h-full object-cover ${className}`
      : `${size} rounded-xl object-cover ${className}`
    return React.createElement("img", {
      src: icon,
      alt: "Ícono",
      className: imgClass,
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

/**
 * AccountIconChip — a fixed-size square chip (~24px) that wraps any account icon
 * so emojis, uploaded logos, lucide icons, and catalog icons all render at the
 * same visual size in selectors.
 *
 * Match the Cuentas list treatment: rounded-md, subtle bg + border, overflow-hidden
 * so images clip cleanly.
 */
export function AccountIconChip({
  icon,
}: {
  icon: string | null | undefined
}): React.ReactElement {
  const isImage = !!icon && (icon.startsWith("http") || icon.startsWith("/"))
  const isEmoji = !!icon && !icon.startsWith("lucide:") && !isImage

  return React.createElement(
    "span",
    {
      className:
        "inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/60 overflow-hidden",
      "aria-hidden": true,
    },
    isImage
      ? React.createElement("img", {
          src: icon!,
          alt: "",
          className: "w-full h-full object-cover",
        })
      : isEmoji
      ? React.createElement(
          "span",
          { className: "text-[13px] leading-none select-none" },
          icon
        )
      : renderAccountIcon(icon, { size: "h-3.5 w-3.5", className: "text-muted-foreground" })
  )
}
