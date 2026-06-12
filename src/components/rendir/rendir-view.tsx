"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, cn } from "@/lib/utils"
import type { AccountBalance } from "@/lib/accounts"
import type { Rendimientos, RateItem } from "@/lib/rendimientos/argentinadatos"
import { TrendingUp, Building2, Smartphone, CircleDollarSign, DollarSign, BarChart2, FileText, Bitcoin } from "lucide-react"

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchBalances(): Promise<AccountBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("account_balances").select("*")
  if (error) throw error
  return data
}

async function fetchRendimientos(): Promise<Rendimientos> {
  const res = await fetch("/api/rendimientos")
  if (!res.ok) throw new Error("Error cargando tasas")
  return res.json()
}

// ── Idle ARS computation ──────────────────────────────────────────────────────

/** Liquid account types in ARS — exclude investments and credit cards. */
const LIQUID_TYPES = new Set<string>([
  "caja_ahorro",
  "cuenta_corriente",
  "efectivo",
  "billetera_virtual",
  "otro",
])

function computeIdleArs(balances: AccountBalance[]): number {
  return balances
    .filter(
      (b) =>
        !b.is_hidden &&
        b.currency === "ARS" &&
        b.account_type != null &&
        LIQUID_TYPES.has(b.account_type),
    )
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)
}

function computeIdleUsd(balances: AccountBalance[]): number {
  return balances
    .filter(
      (b) =>
        !b.is_hidden &&
        b.currency === "USD" &&
        b.account_type != null &&
        LIQUID_TYPES.has(b.account_type),
    )
    .reduce((sum, b) => sum + (b.current_balance ?? 0), 0)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatPct(tna: number): string {
  // tna is a decimal fraction; display as percent with 1 decimal, es-AR style
  return (tna * 100).toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + "%"
}

function monthlyGain(amount: number, tna: number, currency: "ARS" | "USD" = "ARS"): string {
  return formatCurrency(amount * tna / 12, currency)
}

// ── Toggle "Conocidas / Todas" ────────────────────────────────────────────────

type ToggleView = "conocidas" | "todas"

function KnownToggle({
  value,
  onChange,
}: {
  value: ToggleView
  onChange: (v: ToggleView) => void
}) {
  return (
    <div
      role="group"
      aria-label="Filtro de entidades"
      className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5 gap-0"
    >
      <button
        type="button"
        onClick={() => onChange("conocidas")}
        aria-pressed={value === "conocidas"}
        className={cn(
          "inline-flex flex-1 justify-center items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          value === "conocidas"
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Conocidas
      </button>
      <button
        type="button"
        onClick={() => onChange("todas")}
        aria-pressed={value === "todas"}
        className={cn(
          "inline-flex flex-1 justify-center items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          value === "todas"
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Todas
      </button>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RateLogo({ logo, nombre }: { logo?: string | null; nombre: string }) {
  const [errored, setErrored] = useState(false)
  if (logo && !errored) {
    return (
      <img
        src={logo}
        alt=""
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-7 w-7 rounded-md object-contain bg-white p-0.5 flex-shrink-0"
      />
    )
  }
  return (
    <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 uppercase">
      {nombre.charAt(0)}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}

interface RateRowProps {
  item: RateItem
  idleArs: number
  rank: number
  idleAmount?: number
  currency?: "ARS" | "USD"
  /** When provided, show this label instead of "TNA" */
  rateLabel?: string
}

function RateRow({ item, idleArs, rank, idleAmount, currency = "ARS", rateLabel = "TNA" }: RateRowProps) {
  const effectiveIdle = idleAmount !== undefined ? idleAmount : idleArs
  const showProjection = effectiveIdle >= 1
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors">
      {/* Rank badge */}
      <div
        className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
          rank === 1
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {rank}
      </div>

      {/* Logo / avatar */}
      <RateLogo logo={item.logo} nombre={item.nombre} />

      {/* Name + nota */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.nombre}</p>
        {item.nota && (
          <p className="text-xs text-muted-foreground truncate">{item.nota}</p>
        )}
      </div>

      {/* Rate + projection */}
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-semibold tabular-nums", rank === 1 ? "text-primary" : "")}>
          {formatPct(item.tna)} {rateLabel}
        </p>
        {showProjection && (
          <p className="text-xs text-muted-foreground tabular-nums">
            ~{monthlyGain(effectiveIdle, item.tna, currency)}/mes
          </p>
        )}
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  items: RateItem[]
  idleArs: number
  isLoading: boolean
  idleAmount?: number
  currency?: "ARS" | "USD"
  disclaimer?: React.ReactNode
  rateLabel?: string
  /** When true, apply the known/all filter */
  filterable?: boolean
  showKnown?: boolean
}

function Section({
  title,
  icon,
  items,
  idleArs,
  isLoading,
  idleAmount,
  currency,
  disclaimer,
  rateLabel,
  filterable = false,
  showKnown = false,
}: SectionProps) {
  const displayed = filterable && showKnown
    ? items.filter((it) => it.conocida !== false)
    : items

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {isLoading ? (
        <SectionSkeleton />
      ) : displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Sin datos disponibles.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((item, i) => (
            <RateRow
              key={`${item.nombre}-${item.modalidad ?? ""}-${item.moneda ?? ""}`}
              item={item}
              idleArs={idleArs}
              rank={i + 1}
              idleAmount={idleAmount}
              currency={currency}
              rateLabel={rateLabel}
            />
          ))}
        </div>
      )}
      {disclaimer}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RendirView() {
  const [toggleView, setToggleView] = useState<ToggleView>("conocidas")

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["account_balances"],
    queryFn: fetchBalances,
  })

  const { data: rendimientos, isLoading: ratesLoading } = useQuery({
    queryKey: ["rendimientos"],
    queryFn: fetchRendimientos,
    staleTime: 60 * 60 * 1000, // 1h
  })

  const idleArs = balances ? computeIdleArs(balances) : 0
  const idleUsd = balances ? computeIdleUsd(balances) : 0
  const hasIdleArs = idleArs >= 1
  const hasIdleUsd = idleUsd >= 1

  const showKnown = toggleView === "conocidas"

  const allEmpty =
    rendimientos &&
    rendimientos.plazoFijo.length === 0 &&
    rendimientos.billeteras.length === 0 &&
    rendimientos.fci.length === 0

  // Hero personalization: top options for each category
  const topPlazoFijo = rendimientos?.plazoFijo[0]
  const topBilletera = rendimientos?.billeteras[0]
  const topFci = rendimientos?.fci[0]

  return (
    <div className="space-y-6">
      {/* Hero / personalization card */}
      <div className="rounded-2xl p-4 sm:p-5 bg-primary shadow-lg shadow-primary/30 text-primary-foreground space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium opacity-75">Pesos disponibles</p>
          {balancesLoading ? (
            <Skeleton className="h-8 w-40 bg-primary-foreground/20" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">
              {hasIdleArs ? formatCurrency(idleArs, "ARS") : "—"}
            </p>
          )}
          <p className="text-xs opacity-75">
            {hasIdleArs
              ? "en pesos quietos en cuentas líquidas"
              : "No hay pesos líquidos en tus cuentas."}
          </p>
        </div>

        {/* Projected gains row */}
        {hasIdleArs && !ratesLoading && (topPlazoFijo || topBilletera || topFci) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {topPlazoFijo && (
              <div className="rounded-xl bg-primary-foreground/10 p-2.5 space-y-0.5">
                <p className="text-[10px] font-medium opacity-70 uppercase tracking-wide">
                  Mejor plazo fijo
                </p>
                <div className="flex items-center gap-1.5">
                  <RateLogo logo={topPlazoFijo.logo} nombre={topPlazoFijo.nombre} />
                  <p className="text-xs font-semibold truncate">{topPlazoFijo.nombre.split(" ").slice(0, 3).join(" ")}</p>
                </div>
                <p className="text-sm font-bold tabular-nums">
                  ~{monthlyGain(idleArs, topPlazoFijo.tna)}/mes
                </p>
              </div>
            )}
            {topBilletera && (
              <div className="rounded-xl bg-primary-foreground/10 p-2.5 space-y-0.5">
                <p className="text-[10px] font-medium opacity-70 uppercase tracking-wide">
                  Mejor billetera
                </p>
                <div className="flex items-center gap-1.5">
                  <RateLogo logo={topBilletera.logo} nombre={topBilletera.nombre} />
                  <p className="text-xs font-semibold">{topBilletera.nombre}</p>
                </div>
                <p className="text-sm font-bold tabular-nums">
                  ~{monthlyGain(idleArs, topBilletera.tna)}/mes
                </p>
              </div>
            )}
            {topFci && (
              <div className="rounded-xl bg-primary-foreground/10 p-2.5 space-y-0.5">
                <p className="text-[10px] font-medium opacity-70 uppercase tracking-wide">
                  Mejor FCI
                </p>
                <div className="flex items-center gap-1.5">
                  <RateLogo logo={topFci.logo} nombre={topFci.nombre} />
                  <p className="text-xs font-semibold truncate">{topFci.nombre.replace(/ - Clase [A-Z]$/i, "")}</p>
                </div>
                <p className="text-sm font-bold tabular-nums">
                  ~{monthlyGain(idleArs, topFci.tna)}/mes
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global "Conocidas / Todas" toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Filtrar entidades</p>
        <KnownToggle value={toggleView} onChange={setToggleView} />
      </div>

      {/* Empty state for rates */}
      {!ratesLoading && allEmpty && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No pudimos cargar las tasas ahora, probá más tarde.
        </div>
      )}

      {/* ARS sections */}
      {(!allEmpty || ratesLoading) && (
        <>
          <Section
            title="Plazo fijo"
            icon={<Building2 className="h-4 w-4" />}
            items={rendimientos?.plazoFijo ?? []}
            idleArs={idleArs}
            isLoading={ratesLoading}
            filterable
            showKnown={showKnown}
          />
          <Section
            title="Billeteras remuneradas"
            icon={<Smartphone className="h-4 w-4" />}
            items={rendimientos?.billeteras ?? []}
            idleArs={idleArs}
            isLoading={ratesLoading}
            filterable
            showKnown={showKnown}
          />
          <Section
            title="FCI mercado de dinero"
            icon={<CircleDollarSign className="h-4 w-4" />}
            items={rendimientos?.fci ?? []}
            idleArs={idleArs}
            isLoading={ratesLoading}
            filterable
            showKnown={showKnown}
          />
        </>
      )}

      {/* Letras del Tesoro */}
      <Section
        title="LECAPs / Letras del Tesoro"
        icon={<FileText className="h-4 w-4" />}
        items={rendimientos?.letras ?? []}
        idleArs={idleArs}
        isLoading={ratesLoading}
        rateLabel="TNA"
        disclaimer={
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            TNA anualizada desde la TEM mensual · Fechas de vencimiento en zona horaria Argentina.
          </p>
        }
      />

      {/* Plazo Fijo UVA */}
      <Section
        title="Plazo fijo UVA"
        icon={<BarChart2 className="h-4 w-4" />}
        items={rendimientos?.pfUva ?? []}
        idleArs={idleArs}
        isLoading={ratesLoading}
        filterable
        showKnown={showKnown}
        disclaimer={
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            El rendimiento total incluye ajuste por inflación (UVA) más la tasa nominal.
          </p>
        }
      />

      {/* Dólares section */}
      {(() => {
        const usdFciItems = rendimientos?.usdFci ?? []
        const usdStablecoinItems = rendimientos?.usdStablecoin ?? []
        const cuentasUsdItems = rendimientos?.cuentasRemuneradasUsd ?? []
        const criptopesosItems = rendimientos?.criptopesos ?? []
        const usdAllEmpty = !ratesLoading && usdFciItems.length === 0 && usdStablecoinItems.length === 0 && cuentasUsdItems.length === 0
        const topUsd = cuentasUsdItems[0] ?? usdFciItems[0] ?? usdStablecoinItems[0]

        if (usdAllEmpty) {
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground"><DollarSign className="h-4 w-4" /></span>
                <h2 className="text-sm font-semibold">Rendir en dólares</h2>
              </div>
              <p className="text-sm text-muted-foreground py-2">No pudimos cargar las tasas en dólares ahora.</p>
            </div>
          )
        }

        return (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground"><DollarSign className="h-4 w-4" /></span>
              <h2 className="text-sm font-semibold">Rendir en dólares</h2>
            </div>

            {/* Personalization line */}
            {!balancesLoading && hasIdleUsd && topUsd && (
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-0.5">
                <p className="text-sm font-medium">
                  Tenés ~{formatCurrency(idleUsd, "USD")} quietos
                </p>
                <p className="text-xs text-muted-foreground">
                  Con {topUsd.nombre.split(" ").slice(0, 3).join(" ")} podrías ganar ~{monthlyGain(idleUsd, topUsd.tna, "USD")}/mes
                </p>
              </div>
            )}

            {/* Cuentas remuneradas USD */}
            <Section
              title="Cuentas remuneradas en USD"
              icon={<DollarSign className="h-4 w-4" />}
              items={cuentasUsdItems}
              idleArs={idleArs}
              idleAmount={idleUsd}
              currency="USD"
              isLoading={ratesLoading}
              filterable
              showKnown={showKnown}
            />

            {/* FCI en dólares */}
            <Section
              title="FCI en dólares"
              icon={<TrendingUp className="h-4 w-4" />}
              items={usdFciItems}
              idleArs={idleArs}
              idleAmount={idleUsd}
              currency="USD"
              isLoading={ratesLoading}
              filterable
              showKnown={showKnown}
            />

            {/* Stablecoins */}
            <Section
              title="Stablecoins (USDT · USDC · DAI)"
              icon={<CircleDollarSign className="h-4 w-4" />}
              items={usdStablecoinItems}
              idleArs={idleArs}
              idleAmount={idleUsd}
              currency="USD"
              isLoading={ratesLoading}
              filterable
              showKnown={showKnown}
              disclaimer={
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Rendimientos de plataformas cripto — implican riesgo de custodia y no están garantizados.
                </p>
              }
            />

            {/* Criptopesos */}
            {(criptopesosItems.length > 0 || ratesLoading) && (
              <Section
                title="Criptopesos"
                icon={<Bitcoin className="h-4 w-4" />}
                items={criptopesosItems}
                idleArs={idleArs}
                isLoading={ratesLoading}
                filterable
                showKnown={showKnown}
                disclaimer={
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Tokens vinculados al peso argentino en exchanges — riesgo de custodia y no garantizados.
                  </p>
                }
              />
            )}
          </div>
        )
      })()}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed pb-2">
        Tasas estimadas · Datos: ArgentinaDatos · Las proyecciones son
        estimaciones, no rendimientos garantizados.
      </p>
    </div>
  )
}
