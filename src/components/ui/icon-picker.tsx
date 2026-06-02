"use client"

/**
 * IconPicker — bespoke icon selector for mangui account icons.
 * Tabs: Logos (AR fintech catalog or category catalog) | Emojis (full catalog) | Subir imagen
 *
 * Logos + Emojis grids are virtualized with react-window v2 Grid
 * + react-virtualized-auto-sizer, so only visible tiles render.
 * Filtering/search recomputes the flat item list before rendering the grid.
 */

import * as React from "react"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Search, Upload, X, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { AR_FINTECH_ICONS, AR_ICON_CATEGORIES } from "@/lib/ar-fintech-icons"
import { CATEGORY_ICONS, CATEGORY_ICON_GROUPS } from "@/lib/category-icons"
import { EXTRA_ACCOUNT_ICONS } from "@/lib/extra-account-icons"
import { cn } from "@/lib/utils"
import { EMOJI_CATALOG, searchEmojis } from "@/lib/emoji-catalog"
import { createClient } from "@/lib/supabase/client"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Grid } from "react-window"
import { AutoSizer } from "react-virtualized-auto-sizer"
import type { CSSProperties } from "react"

// ── Shared tile classes ───────────────────────────────────────────────────────

const TILE_BASE = cn(
  "aspect-square flex flex-col items-center justify-center rounded-xl border transition-colors duration-150 cursor-pointer",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "hover:bg-accent/20",
  "bg-muted/30 border-border/50"
)

const TILE_SELECTED = "ring-2 ring-primary bg-primary/10 border-primary/40"

// Grid layout constants
const LOGO_TILE_SIZE = 72  // px
const EMOJI_TILE_SIZE = 64  // px
const GRID_GAP = 8           // px
const GRID_PADDING = 4        // px

function getColCount(width: number, tileSize: number): number {
  // Floor to how many tiles fit with gaps
  const cols = Math.floor((width - GRID_PADDING * 2 + GRID_GAP) / (tileSize + GRID_GAP))
  return Math.max(1, cols)
}

// ── Category chip row with arrow navigation ───────────────────────────────────

function CategoryChips({
  categories,
  active,
  onSelect,
}: {
  categories: { id: string; label: string }[]
  active: string
  onSelect: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener("scroll", checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      ro.disconnect()
    }
  }, [checkScroll])

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" })
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={() => scroll("left")}
        aria-label="Desplazar categorías a la izquierda"
        tabIndex={canScrollLeft ? 0 : -1}
        className={cn(
          "shrink-0 h-6 w-6 rounded-md flex items-center justify-center transition-opacity duration-150",
          "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none flex-1"
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        aria-label="Desplazar categorías a la derecha"
        tabIndex={canScrollRight ? 0 : -1}
        className={cn(
          "shrink-0 h-6 w-6 rounded-md flex items-center justify-center transition-opacity duration-150",
          "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

// ── Virtualized Logos grid ────────────────────────────────────────────────────

type LogoCellProps = {
  items: typeof AR_FINTECH_ICONS
  selectedValue: string
  onSelect: (path: string) => void
  colCount: number
}

function LogoCell({
  columnIndex,
  rowIndex,
  style,
  items,
  selectedValue,
  onSelect,
  colCount,
}: {
  columnIndex: number
  rowIndex: number
  style: CSSProperties
  ariaAttributes: { "aria-colindex": number; role: "gridcell" }
} & LogoCellProps) {
  const idx = rowIndex * colCount + columnIndex
  if (idx >= items.length) return <div style={style} />
  const icon = items[idx]
  const isSelected = selectedValue === icon.path
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => onSelect(icon.path)}
        title={icon.title}
        aria-label={icon.title}
        aria-pressed={isSelected}
        style={{ width: LOGO_TILE_SIZE - GRID_GAP, height: LOGO_TILE_SIZE - GRID_GAP }}
        className={cn(
          TILE_BASE,
          "gap-1 flex-col overflow-hidden",
          isSelected ? TILE_SELECTED : ""
        )}
      >
        {/* Logo tile — full-bleed square tile with rounded corners.
            Both bank/AR logos and crypto tiles are full-bleed squares (object-cover). */}
        <div
          className={cn(
            "w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center aspect-square",
            "bg-muted border border-border/60"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={icon.path}
            alt={icon.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <span className="text-[9px] font-medium leading-tight truncate w-full text-center px-1 text-muted-foreground">
          {icon.title}
        </span>
      </button>
    </div>
  )
}

const ACCOUNT_ICONS = [...AR_FINTECH_ICONS, ...EXTRA_ACCOUNT_ICONS]

function LogosTab({
  value,
  onSelect,
}: {
  value: string
  onSelect: (v: string) => void
}) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState(AR_ICON_CATEGORIES[0].id)

  const filtered = useMemo(() => {
    if (search.trim()) {
      return ACCOUNT_ICONS.filter(
        (icon) =>
          icon.title.toLowerCase().includes(search.toLowerCase()) ||
          icon.id.toLowerCase().includes(search.toLowerCase())
      )
    }
    return ACCOUNT_ICONS.filter((icon) => {
      const cat = AR_ICON_CATEGORIES.find((c) => c.label === icon.category)
      return cat?.id === activeCategory
    })
  }, [search, activeCategory])

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

      {/* Category chips (only when not searching) */}
      {!search && (
        <CategoryChips
          categories={AR_ICON_CATEGORIES}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
      )}

      {/* Virtualized grid */}
      <div className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin resultados para &ldquo;{search}&rdquo;
          </p>
        ) : (
          <AutoSizer
            renderProp={({ width, height }) => {
              if (!width || !height) return null
              const colCount = getColCount(width, LOGO_TILE_SIZE)
              const rowCount = Math.ceil(filtered.length / colCount)
              const colWidth = Math.floor((width - GRID_PADDING * 2) / colCount)
              return (
                <Grid
                  columnCount={colCount}
                  rowCount={rowCount}
                  columnWidth={colWidth}
                  rowHeight={LOGO_TILE_SIZE}
                  style={{ width, height, outline: "none" }}
                  cellComponent={LogoCell}
                  cellProps={{
                    items: filtered,
                    selectedValue: value,
                    onSelect,
                    colCount,
                  }}
                />
              )
            }}
          />
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

// ── Category logos tab (for categories catalog) ───────────────────────────────

// Convert CATEGORY_ICON_GROUPS (plain strings) into chips format
const CATEGORY_GROUP_CHIPS: { id: string; label: string }[] = CATEGORY_ICON_GROUPS.map(
  (g) => ({ id: g, label: g })
)

function CategoryLogosTab({
  value,
  onSelect,
}: {
  value: string
  onSelect: (v: string) => void
}) {
  const [search, setSearch] = useState("")
  const [activeGroup, setActiveGroup] = useState(CATEGORY_ICON_GROUPS[0])

  const filtered = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return CATEGORY_ICONS.filter(
        (icon) =>
          icon.title.toLowerCase().includes(q) ||
          icon.keywords.some((kw) => kw.toLowerCase().includes(q))
      )
    }
    return CATEGORY_ICONS.filter((icon) => icon.category === activeGroup)
  }, [search, activeGroup])

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          type="text"
          placeholder="Buscar categoría…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full pl-8 pr-3 h-8 rounded-lg border border-input bg-background text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
            "placeholder:text-muted-foreground"
          )}
          aria-label="Buscar ícono de categoría"
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

      {/* Group chips (only when not searching) */}
      {!search && (
        <CategoryChips
          categories={CATEGORY_GROUP_CHIPS}
          active={activeGroup}
          onSelect={setActiveGroup}
        />
      )}

      {/* Virtualized grid */}
      <div className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {search ? `Sin resultados para "${search}"` : "Sin íconos en esta categoría"}
          </p>
        ) : (
          <AutoSizer
            renderProp={({ width, height }) => {
              if (!width || !height) return null
              const colCount = getColCount(width, LOGO_TILE_SIZE)
              const rowCount = Math.ceil(filtered.length / colCount)
              const colWidth = Math.floor((width - GRID_PADDING * 2) / colCount)
              return (
                <Grid
                  columnCount={colCount}
                  rowCount={rowCount}
                  columnWidth={colWidth}
                  rowHeight={LOGO_TILE_SIZE}
                  style={{ width, height, outline: "none" }}
                  cellComponent={LogoCell}
                  cellProps={{
                    items: filtered,
                    selectedValue: value,
                    onSelect,
                    colCount,
                  }}
                />
              )
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Virtualized Emojis grid ───────────────────────────────────────────────────

type EmojiEntry = { emoji: string; keywords: string[] }

type EmojiCellProps = {
  items: EmojiEntry[]
  selectedValue: string
  onSelect: (emoji: string) => void
  colCount: number
}

function EmojiCell({
  columnIndex,
  rowIndex,
  style,
  items,
  selectedValue,
  onSelect,
  colCount,
}: {
  columnIndex: number
  rowIndex: number
  style: CSSProperties
  ariaAttributes: { "aria-colindex": number; role: "gridcell" }
} & EmojiCellProps) {
  const idx = rowIndex * colCount + columnIndex
  if (idx >= items.length) return <div style={style} />
  const entry = items[idx]
  const isSelected = selectedValue === entry.emoji
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => onSelect(entry.emoji)}
        title={entry.keywords[0]}
        aria-label={entry.keywords[0]}
        aria-pressed={isSelected}
        style={{ width: EMOJI_TILE_SIZE - GRID_GAP, height: EMOJI_TILE_SIZE - GRID_GAP }}
        className={cn(
          TILE_BASE,
          "text-2xl",
          isSelected ? TILE_SELECTED : ""
        )}
      >
        {entry.emoji}
      </button>
    </div>
  )
}

function EmojiTab({
  value,
  onSelect,
}: {
  value: string
  onSelect: (v: string) => void
}) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATALOG[0].id)

  const flatItems = useMemo<EmojiEntry[]>(() => {
    if (search.trim()) {
      return searchEmojis(search)
    }
    const cat = EMOJI_CATALOG.find((c) => c.id === activeCategory)
    return cat ? cat.emojis : []
  }, [search, activeCategory])

  const categoryChips = useMemo(
    () => EMOJI_CATALOG.map((c) => ({ id: c.id, label: c.label })),
    []
  )

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

      {/* Category chips (only when not searching) */}
      {!search && (
        <CategoryChips
          categories={categoryChips}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
      )}

      {/* Virtualized grid */}
      <div className="flex-1 min-h-0">
        {flatItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {search ? `Sin resultados para "${search}"` : "Sin emojis en esta categoría"}
          </p>
        ) : (
          <AutoSizer
            renderProp={({ width, height }) => {
              if (!width || !height) return null
              const colCount = getColCount(width, EMOJI_TILE_SIZE)
              const rowCount = Math.ceil(flatItems.length / colCount)
              const colWidth = Math.floor((width - GRID_PADDING * 2) / colCount)
              return (
                <Grid
                  columnCount={colCount}
                  rowCount={rowCount}
                  columnWidth={colWidth}
                  rowHeight={EMOJI_TILE_SIZE}
                  style={{ width, height, outline: "none" }}
                  cellComponent={EmojiCell}
                  cellProps={{
                    items: flatItems,
                    selectedValue: value,
                    onSelect,
                    colCount,
                  }}
                />
              )
            }}
          />
        )}
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
              className="h-14 w-14 rounded-xl object-cover border border-border/60"
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

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "logos" | "emojis" | "subir"

// ── Props ─────────────────────────────────────────────────────────────────────

interface IconPickerProps {
  open: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  userId?: string
  /** Which logo catalog to show in the Logos tab. Defaults to "accounts" (AR fintech). */
  logoCatalog?: "accounts" | "categories"
}

// ── Main IconPicker ───────────────────────────────────────────────────────────

export function IconPicker({ open, onClose, value, onChange, userId, logoCatalog = "accounts" }: IconPickerProps) {
  const [tab, setTab] = useState<Tab>("logos")

  function handleSelect(v: string) {
    onChange(v)
    onClose()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "logos", label: "Logos" },
    { id: "emojis", label: "Emojis" },
    { id: "subir", label: "Subir imagen" },
  ]

  return (
    <MangoSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Elegí un ícono"
    >
      {/* Tab bar */}
      <div className="flex gap-0.5 -mx-4 -mt-4 px-4 pt-3 pb-0 shrink-0 border-b border-border/60 mb-3">
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

      {/* Tab content — fixed height so grid can size itself */}
      <div className="h-[360px] flex flex-col">
        {tab === "logos" && logoCatalog === "categories" && (
          <CategoryLogosTab value={value} onSelect={handleSelect} />
        )}
        {tab === "logos" && logoCatalog === "accounts" && (
          <LogosTab value={value} onSelect={handleSelect} />
        )}
        {tab === "emojis" && (
          <EmojiTab value={value} onSelect={handleSelect} />
        )}
        {tab === "subir" && (
          <SubirTab value={value} onSelect={handleSelect} userId={userId} />
        )}
      </div>
    </MangoSheet>
  )
}
