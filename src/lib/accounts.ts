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
