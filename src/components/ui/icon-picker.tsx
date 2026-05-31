"use client"

/**
 * IconPicker — bespoke icon selector modal for mangui account icons.
 * Tabs: Emojis (searchable catalog) | Íconos (lucide finance set) | Bancos AR | Subir imagen
 * Stores: emoji string | "lucide:<name>" | /icons/ar/… path | public image URL
 */

import * as React from "react"
import { useState, useRef, useCallback } from "react"
import { Search, Upload, X, Check } from "lucide-react"
import { AR_FINTECH_ICONS, AR_ICON_CATEGORIES } from "@/lib/ar-fintech-icons"
import {
  // Finance / account icons
  Landmark,
  Building2,
  Banknote,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Smartphone,
  Briefcase,
  Wallet,
  PiggyBank,
  DollarSign,
  Euro,
  BadgeDollarSign,
  CircleDollarSign,
  Coins,
  HandCoins,
  Vault,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  Store,
  Package,
  Home,
  Building,
  Car,
  Plane,
  Heart,
  Star,
  Zap,
  Gift,
  Coffee,
  Utensils,
  BookOpen,
  GraduationCap,
  Wrench,
  Hammer,
  Paintbrush,
  Music,
  Film,
  Gamepad2,
  Globe,
  MapPin,
  Clock,
  Target,
  BarChart2,
  LineChart,
  PieChart,
  Wifi,
  Laptop,
  Monitor,
  Phone,
  Key,
  Lock,
  Shield,
  Award,
  Trophy,
  Leaf,
  Sun,
  Umbrella,
  Snowflake,
  Flame,
  Droplets,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EMOJI_CATALOG, searchEmojis, type EmojiCategory } from "@/lib/emoji-catalog"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ── Lucide icon set for finance/accounts ─────────────────────────────────────

interface LucideOption {
  name: string
  label: string
  icon: LucideIcon
}

const LUCIDE_FINANCE_ICONS: LucideOption[] = [
  { name: "Landmark", label: "Banco", icon: Landmark },
  { name: "Building2", label: "Edificio", icon: Building2 },
  { name: "Banknote", label: "Billete", icon: Banknote },
  { name: "TrendingUp", label: "Inversión", icon: TrendingUp },
  { name: "TrendingDown", label: "Baja", icon: TrendingDown },
  { name: "CreditCard", label: "Tarjeta", icon: CreditCard },
  { name: "Smartphone", label: "Celular", icon: Smartphone },
  { name: "Briefcase", label: "Maletín", icon: Briefcase },
  { name: "Wallet", label: "Billetera", icon: Wallet },
  { name: "PiggyBank", label: "Alcancía", icon: PiggyBank },
  { name: "DollarSign", label: "Dólar", icon: DollarSign },
  { name: "Euro", label: "Euro", icon: Euro },
  { name: "BadgeDollarSign", label: "Insignia $", icon: BadgeDollarSign },
  { name: "CircleDollarSign", label: "Círculo $", icon: CircleDollarSign },
  { name: "Coins", label: "Monedas", icon: Coins },
  { name: "HandCoins", label: "Dar dinero", icon: HandCoins },
  { name: "Vault", label: "Caja fuerte", icon: Vault },
  { name: "ReceiptText", label: "Recibo", icon: ReceiptText },
  { name: "ShoppingCart", label: "Carrito", icon: ShoppingCart },
  { name: "ShoppingBag", label: "Bolsa", icon: ShoppingBag },
  { name: "Store", label: "Tienda", icon: Store },
  { name: "Package", label: "Paquete", icon: Package },
  { name: "Home", label: "Casa", icon: Home },
  { name: "Building", label: "Edificio", icon: Building },
  { name: "Car", label: "Auto", icon: Car },
  { name: "Plane", label: "Avión", icon: Plane },
  { name: "Heart", label: "Salud", icon: Heart },
  { name: "Star", label: "Estrella", icon: Star },
  { name: "Zap", label: "Energía", icon: Zap },
  { name: "Gift", label: "Regalo", icon: Gift },
  { name: "Coffee", label: "Café", icon: Coffee },
  { name: "Utensils", label: "Comida", icon: Utensils },
  { name: "BookOpen", label: "Educación", icon: BookOpen },
  { name: "GraduationCap", label: "Estudio", icon: GraduationCap },
  { name: "Wrench", label: "Herramienta", icon: Wrench },
  { name: "Hammer", label: "Martillo", icon: Hammer },
  { name: "Paintbrush", label: "Arte", icon: Paintbrush },
  { name: "Music", label: "Música", icon: Music },
  { name: "Film", label: "Cine", icon: Film },
  { name: "Gamepad2", label: "Juegos", icon: Gamepad2 },
  { name: "Globe", label: "Internet", icon: Globe },
  { name: "MapPin", label: "Ubicación", icon: MapPin },
  { name: "Clock", label: "Tiempo", icon: Clock },
  { name: "Target", label: "Objetivo", icon: Target },
  { name: "BarChart2", label: "Gráfico barras", icon: BarChart2 },
  { name: "LineChart", label: "Gráfico línea", icon: LineChart },
  { name: "PieChart", label: "Torta", icon: PieChart },
  { name: "Wifi", label: "Internet", icon: Wifi },
  { name: "Laptop", label: "Notebook", icon: Laptop },
  { name: "Monitor", label: "Monitor", icon: Monitor },
  { name: "Phone", label: "Teléfono", icon: Phone },
  { name: "Key", label: "Llave", icon: Key },
  { name: "Lock", label: "Candado", icon: Lock },
  { name: "Shield", label: "Seguro", icon: Shield },
  { name: "Award", label: "Premio", icon: Award },
  { name: "Trophy", label: "Trofeo", icon: Trophy },
  { name: "Leaf", label: "Natural", icon: Leaf },
  { name: "Sun", label: "Sol", icon: Sun },
  { name: "Umbrella", label: "Paraguas", icon: Umbrella },
  { name: "Snowflake", label: "Nieve", icon: Snowflake },
  { name: "Flame", label: "Fuego", icon: Flame },
  { name: "Droplets", label: "Agua", icon: Droplets },
]

// ── Bancos AR tab ─────────────────────────────────────────────────────────────

function BancosArTab({
  value,
  onSelect,
}: {
  value: string
  onSelect: (v: string) => void
}) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState(AR_ICON_CATEGORIES[0].id)

  const filtered = search.trim()
    ? AR_FINTECH_ICONS.filter((icon) =>
        icon.title.toLowerCase().includes(search.toLowerCase()) ||
        icon.id.toLowerCase().includes(search.toLowerCase())
      )
    : AR_FINTECH_ICONS.filter((icon) => {
        const cat = AR_ICON_CATEGORIES.find((c) => c.label === icon.category)
        return cat?.id === activeCategory
      })

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          type="text"
          placeholder="Buscar banco, acción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full pl-8 pr-3 h-8 rounded-lg border border-input bg-background text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
            "placeholder:text-muted-foreground"
          )}
          aria-label="Buscar ícono financiero AR"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category tabs (only when not searching) */}
      {!search && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {AR_ICON_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Icon grid */}
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin resultados para &ldquo;{search}&rdquo;
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {filtered.map((icon) => {
              const isSelected = value === icon.path
              return (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => onSelect(icon.path)}
                  title={icon.title}
                  aria-label={icon.title}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 h-16 rounded-xl border transition-colors duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "hover:bg-accent/20",
                    isSelected
                      ? "bg-primary/15 border-primary/40"
                      : "border-border/60"
                  )}
                >
                  {/* White/zinc chip so dark logos are visible in dark mode */}
                  <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={icon.path}
                      alt={icon.title}
                      className="h-7 w-7 object-contain"
                      loading="lazy"
                    />
                  </div>
                  <span className="text-[9px] font-medium leading-tight truncate w-full text-center px-1 text-muted-foreground">
                    {icon.title}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Attribution */}
      <p className="text-[10px] text-muted-foreground text-center shrink-0">
        Íconos por{" "}
        <a
          href="https://icons.com.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          icons.com.ar
        </a>
      </p>
    </div>
  )
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "emojis" | "iconos" | "bancos-ar" | "subir"

// ── Props ─────────────────────────────────────────────────────────────────────

interface IconPickerProps {
  open: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  userId?: string
}

// ── Emoji tab ─────────────────────────────────────────────────────────────────

function EmojiTab({
  value,
  onSelect,
}: {
  value: string
  onSelect: (v: string) => void
}) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATALOG[0].id)

  const searchResults = search.trim() ? searchEmojis(search) : null

  const displayCategories: EmojiCategory[] = searchResults
    ? [{ id: "search", label: "Resultados", emojis: searchResults }]
    : EMOJI_CATALOG

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          type="text"
          placeholder="Buscar emoji…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full pl-8 pr-3 h-8 rounded-lg border border-input bg-background text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
            "placeholder:text-muted-foreground"
          )}
          aria-label="Buscar emoji"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category tabs (only when not searching) */}
      {!search && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {EMOJI_CATALOG.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-y-auto flex-1 -mx-1 px-1">
        {displayCategories
          .filter((cat) => !search || cat.id === "search" || cat.id === activeCategory)
          .map((cat) => {
            const emojis = cat.id === "search"
              ? cat.emojis
              : search
              ? cat.emojis
              : cat.id === activeCategory
              ? cat.emojis
              : []

            if (emojis.length === 0) return null

            return (
              <div key={cat.id} className="mb-3">
                {search && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
                    {cat.id === "search" ? `${emojis.length} resultados` : cat.label}
                  </p>
                )}
                <div className="grid grid-cols-8 gap-1">
                  {emojis.map((entry) => (
                    <button
                      key={entry.emoji}
                      type="button"
                      onClick={() => onSelect(entry.emoji)}
                      title={entry.keywords[0]}
                      className={cn(
                        "h-9 w-full rounded-lg flex items-center justify-center text-xl",
                        "transition-colors duration-100 cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "hover:bg-accent/20",
                        value === entry.emoji
                          ? "bg-primary/15 ring-1 ring-primary/40"
                          : ""
                      )}
                      aria-label={entry.keywords[0]}
                      aria-pressed={value === entry.emoji}
                    >
                      {entry.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        {searchResults && searchResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin resultados para &ldquo;{search}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

// ── Lucide icons tab ──────────────────────────────────────────────────────────

function IconosTab({
  value,
  onSelect,
}: {
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="overflow-y-auto">
      <div className="grid grid-cols-5 gap-2">
        {LUCIDE_FINANCE_ICONS.map((opt) => {
          const iconValue = `lucide:${opt.name}`
          const isSelected = value === iconValue
          const Icon = opt.icon
          return (
            <button
              key={opt.name}
              type="button"
              onClick={() => onSelect(iconValue)}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-16 rounded-xl border transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:bg-accent/20",
                isSelected
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "border-border/60 text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium leading-tight truncate w-full text-center px-1">
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Upload tab ────────────────────────────────────────────────────────────────

function SubirTab({
  value,
  onSelect,
  userId,
}: {
  value: string
  onSelect: (url: string) => void
  userId?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(
    value && (value.startsWith("http") || value.startsWith("/")) ? value : null
  )

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return
      if (!userId) {
        setError("Necesitás estar autenticado para subir imágenes.")
        return
      }
      if (!file.type.startsWith("image/")) {
        setError("Solo se admiten imágenes (JPG, PNG, WebP, SVG).")
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("La imagen no puede superar 2 MB.")
        return
      }

      setError(null)
      setUploading(true)

      // Preview locally while uploading
      const localUrl = URL.createObjectURL(file)
      setPreview(localUrl)

      try {
        const ext = file.name.split(".").pop() ?? "jpg"
        const path = `${userId}/${crypto.randomUUID()}.${ext}`
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from("icons")
          .upload(path, file, { upsert: false, contentType: file.type })

        if (uploadError) {
          setError(`Error al subir: ${uploadError.message}`)
          setPreview(null)
          return
        }

        const { data: urlData } = supabase.storage.from("icons").getPublicUrl(path)
        const publicUrl = urlData.publicUrl
        setPreview(publicUrl)
        onSelect(publicUrl)
      } catch {
        setError("No se pudo subir la imagen. Intentá de nuevo.")
        setPreview(null)
      } finally {
        setUploading(false)
      }
    },
    [userId, onSelect]
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        disabled={uploading}
        className={cn(
          "flex flex-col items-center justify-center gap-3 h-40 rounded-xl border-2 border-dashed",
          "transition-colors duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          uploading
            ? "border-primary/40 bg-primary/5 cursor-wait"
            : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
              aria-label="Subiendo…"
            />
            <span className="text-sm text-muted-foreground">Subiendo…</span>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Ícono seleccionado"
              className="h-14 w-14 rounded-full object-cover border border-border/60"
            />
            <span className="text-xs text-muted-foreground">
              Hacé clic para cambiar
            </span>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="text-center space-y-0.5">
              <p className="text-sm font-medium">Subí una imagen</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP o SVG · máx. 2 MB
              </p>
            </div>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden
        tabIndex={-1}
      />

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {preview && !uploading && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2">
          <Check className="h-4 w-4 text-success shrink-0" aria-hidden />
          <span className="text-xs text-success font-medium">Imagen lista para usar como ícono</span>
        </div>
      )}

      {!userId && (
        <p className="text-xs text-muted-foreground text-center">
          La subida de imágenes requiere estar autenticado.
        </p>
      )}
    </div>
  )
}

// ── Main IconPicker ───────────────────────────────────────────────────────────

export function IconPicker({ open, onClose, value, onChange, userId }: IconPickerProps) {
  const [tab, setTab] = useState<Tab>("emojis")

  function handleSelect(v: string) {
    onChange(v)
    onClose()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "emojis", label: "Emojis" },
    { id: "iconos", label: "Íconos" },
    { id: "bancos-ar", label: "Bancos AR" },
    { id: "subir", label: "Subir imagen" },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
          <DialogTitle>Elegí un ícono</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-t-lg text-sm font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.id
                  ? "bg-background border border-b-0 border-border/60 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden px-4 pt-3 pb-4">
          {tab === "emojis" && (
            <EmojiTab value={value} onSelect={handleSelect} />
          )}
          {tab === "iconos" && (
            <IconosTab value={value} onSelect={handleSelect} />
          )}
          {tab === "bancos-ar" && (
            <BancosArTab value={value} onSelect={handleSelect} />
          )}
          {tab === "subir" && (
            <SubirTab value={value} onSelect={handleSelect} userId={userId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
