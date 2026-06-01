"use client"

/**
 * SelectionBar — sticky floating bar shown during multi-select mode.
 *
 * Consistent across ALL list sections. Place at page level; it portals
 * itself above the bottom nav safe-area on mobile.
 *
 * Props:
 *   count          number of selected items
 *   total          total visible items (for "select all" label)
 *   onSelectAll    called to toggle all-selected / none-selected
 *   onDelete       called when user taps "Eliminar (N)"
 *   onCancel       called when user taps "Cancelar"
 *   isPending?     disables buttons while a delete is in progress
 */

import * as React from "react"
import { Trash2, X, CheckSquare, Square } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectionBarProps {
  count: number
  total: number
  onSelectAll: () => void
  onDelete: () => void
  onCancel: () => void
  isPending?: boolean
}

export function SelectionBar({
  count,
  total,
  onSelectAll,
  onDelete,
  onCancel,
  isPending = false,
}: SelectionBarProps) {
  const allSelected = total > 0 && count === total

  return (
    <div
      role="toolbar"
      aria-label="Barra de selección múltiple"
      className={cn(
        // Sticky floating bar — sits just above mobile bottom nav.
        // On desktop start AFTER the 16rem sidebar so the left rounded corner
        // isn't hidden behind it (both rounded corners visible within content).
        "fixed z-40 left-0 right-0 lg:left-64",
        // Bottom position respects safe area + 4rem (bottom nav height)
        "bottom-[calc(4rem+env(safe-area-inset-bottom))]",
        // Desktop: a narrower bar centered
        "flex items-center justify-between gap-2",
        "mx-4 mb-2 px-3 py-2.5",
        "rounded-2xl",
        "bg-card border border-border/60",
        "shadow-lg shadow-black/10 dark:shadow-black/30",
        // Subtle tinted shadow per design spec
        "[box-shadow:0_10px_15px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)]",
        "dark:[box-shadow:0_10px_15px_rgba(0,0,0,.25),0_0_0_1px_rgba(255,255,255,.06)]",
        // Entrance animation — fade + slide up, skip if reduced motion
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-200 motion-reduce:animate-none"
      )}
    >
      {/* Count label */}
      <span className="text-sm font-semibold tabular-nums shrink-0 text-foreground">
        {count}{" "}
        <span className="font-normal text-muted-foreground">
          {count === 1 ? "seleccionada" : "seleccionadas"}
        </span>
      </span>

      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {/* Select all / none toggle */}
        <button
          type="button"
          onClick={onSelectAll}
          disabled={isPending || total === 0}
          aria-label={allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold",
            "border border-border/60 bg-muted/60 text-muted-foreground",
            "hover:bg-muted hover:text-foreground transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "active:scale-[.97] transition-transform motion-reduce:transition-none",
            "min-w-[44px]"
          )}
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Square className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {allSelected ? "Ninguno" : "Todos"}
          </span>
        </button>

        {/* Delete button — destructive, always visible */}
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending || count === 0}
          aria-label={`Eliminar ${count} elemento${count !== 1 ? "s" : ""}`}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold",
            "bg-destructive text-destructive-foreground",
            "hover:bg-destructive/90 transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "active:scale-[.97] transition-transform motion-reduce:transition-none",
            "shadow-sm shadow-destructive/20",
            "min-w-[44px]"
          )}
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {isPending ? "Eliminando…" : `Eliminar (${count})`}
          </span>
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          aria-label="Cancelar selección"
          className={cn(
            "inline-flex items-center justify-center h-9 w-9 rounded-xl",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "active:scale-[.97] transition-transform motion-reduce:transition-none"
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

// ── "Seleccionar" entry button ───────────────────────────────────────────────
// Used in every list header. One shared component = one source of truth.

export interface SelectButtonProps {
  onClick: () => void
  className?: string
}

export function SelectButton({ onClick, className }: SelectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Seleccionar elementos"
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-semibold",
        "border border-border/60 bg-muted/40 text-muted-foreground",
        "hover:bg-muted hover:text-foreground transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:scale-[.97] transition-transform motion-reduce:transition-none",
        className
      )}
    >
      <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Seleccionar</span>
    </button>
  )
}

// ── Row checkbox — consistent across all lists ────────────────────────────────

export interface RowCheckboxProps {
  checked: boolean
  onChange: () => void
  label?: string
}

export function RowCheckbox({ checked, onChange, label }: RowCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Deseleccionar" : "Seleccionar")}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        "flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:scale-[.93] motion-reduce:transition-none",
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-border/70 bg-background hover:border-primary/60"
      )}
    >
      {checked && (
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="2,6.5 5,9.5 10,3.5" />
        </svg>
      )}
    </button>
  )
}

// ── Selected item ring — apply to card wrappers ───────────────────────────────
// Usage: cn(selectedItemCn(isSelected), "your-existing-classes")

export function selectedItemCn(isSelected: boolean): string {
  return isSelected
    ? "ring-2 ring-primary/60 ring-offset-1 bg-primary/5 dark:bg-primary/10"
    : ""
}
