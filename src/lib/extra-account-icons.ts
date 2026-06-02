// Extra account icons sourced from the category-icons catalog.
// Brands not already present in AR_FINTECH_ICONS, grouped into the two
// relevant account categories ("Bancos y Billeteras" / "Cripto").
// Paths reuse the existing /icons/categories/ PNGs — no files copied.

import type { ArFintechIcon } from "./ar-fintech-icons"

export const EXTRA_ACCOUNT_ICONS: ArFintechIcon[] = [
  // ── 🪙 Crypto Argentina (not already in ar-fintech-icons) ──────────────────
  { id: "cat-bitso",          title: "Bitso",          category: "Cripto",              path: "/icons/categories/bitso_com.png" },

  // ── 🌐 Crypto Internacional ────────────────────────────────────────────────
  { id: "cat-binance",        title: "Binance",        category: "Cripto",              path: "/icons/categories/binance_com.png" },
  { id: "cat-blockchaincom",  title: "Blockchain.com", category: "Cripto",              path: "/icons/categories/blockchain_com.png" },
  { id: "cat-bybit",          title: "Bybit",          category: "Cripto",              path: "/icons/categories/bybit_com.png" },
  { id: "cat-coinbase",       title: "Coinbase",       category: "Cripto",              path: "/icons/categories/coinbase_com.png" },
  { id: "cat-cryptocom",      title: "Crypto.com",     category: "Cripto",              path: "/icons/categories/crypto_com.png" },
  { id: "cat-kraken",         title: "Kraken",         category: "Cripto",              path: "/icons/categories/kraken_com.png" },
  { id: "cat-kucoin",         title: "KuCoin",         category: "Cripto",              path: "/icons/categories/kucoin_com.png" },
  { id: "cat-okx",            title: "OKX",            category: "Cripto",              path: "/icons/categories/okx_com.png" },

  // ── 💳 Pagos Internacionales ───────────────────────────────────────────────
  { id: "cat-n26",            title: "N26",            category: "Bancos y Billeteras", path: "/icons/categories/n26_com.png" },
  { id: "cat-payoneer",       title: "Payoneer",       category: "Bancos y Billeteras", path: "/icons/categories/payoneer_com.png" },
  { id: "cat-paypal",         title: "PayPal",         category: "Bancos y Billeteras", path: "/icons/categories/paypal_com.png" },
  { id: "cat-paysafecard",    title: "Paysafecard",    category: "Bancos y Billeteras", path: "/icons/categories/paysafecard_com.png" },
  { id: "cat-revolut",        title: "Revolut",        category: "Bancos y Billeteras", path: "/icons/categories/revolut_com.png" },
  { id: "cat-skrill",         title: "Skrill",         category: "Bancos y Billeteras", path: "/icons/categories/skrill_com.png" },
  { id: "cat-stripe",         title: "Stripe",         category: "Bancos y Billeteras", path: "/icons/categories/stripe_com.png" },
  { id: "cat-wise",           title: "Wise",           category: "Bancos y Billeteras", path: "/icons/categories/wise_com.png" },
  { id: "cat-visa",           title: "Visa",           category: "Bancos y Billeteras", path: "/icons/categories/gb_visa.png" },
  { id: "cat-mastercard",     title: "Mastercard",     category: "Bancos y Billeteras", path: "/icons/categories/gb_mastercard.png" },
  { id: "cat-amex",           title: "American Express", category: "Bancos y Billeteras", path: "/icons/categories/gb_amex.png" },
  { id: "cat-adyen",          title: "Adyen",          category: "Bancos y Billeteras", path: "/icons/categories/gb_adyen.png" },
  { id: "cat-square",         title: "Square",         category: "Bancos y Billeteras", path: "/icons/categories/gb_square.png" },

  // ── 📈 Inversiones Argentina ───────────────────────────────────────────────
  { id: "cat-bullmarket",     title: "Bull Market",    category: "Bancos y Billeteras", path: "/icons/categories/bullmarketbrokers_com.png" },
  { id: "cat-invertironline", title: "InvertirOnline", category: "Bancos y Billeteras", path: "/icons/categories/invertironline_com.png" },
  { id: "cat-portfoliopersonal", title: "Portfolio Personal", category: "Bancos y Billeteras", path: "/icons/categories/portfoliopersonal_com.png" },
]
