"use client"

/**
 * MangoMultiSelect — multi-select sibling of MangoSelect.
 * Parallel component: same popover positioning, keyboard navigation,
 * accent-insensitive search, and leading icon rendering as MangoSelect.
 * Differences: value is string[], clicking toggles membership (does NOT close),
 * trigger shows selected count or chips, footer "Limpiar" clears all.
 */

import * as React from "react"
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Normalize a string: lowercase + strip diacritics. */
function normalizeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export interface MangoMultiSelectOption {
  value: string
  label: string
  /** Optional leading node: flag emoji, lucide icon, AccountIconChip, etc. */
  leading?: React.ReactNode
  disabled?: boolean
}

export interface MangoMultiSelectProps {
  /** Controlled selected values */
  values: string[]
  onChange: (values: string[]) => void
  options: MangoMultiSelectOption[]
  placeholder?: string
  /** Renders an accent-insensitive search input at the top of the open popover. */
  showSearch?: boolean
  /** Additional class for the trigger button */
  triggerClassName?: string
  disabled?: boolean
  id?: string
  "aria-label"?: string
}

export function MangoMultiSelect({
  values,
  onChange,
  options,
  placeholder = "Seleccioná…",
  showSearch = false,
  triggerClassName,
  disabled,
  id,
  "aria-label": ariaLabel,
}: MangoMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placeAbove: false })
  const [posReady, setPosReady] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [searchQuery, setSearchQuery] = useState("")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // When showSearch is active, filter by normalized label; otherwise use all options.
  const filteredOptions =
    showSearch && searchQuery
      ? options.filter((o) =>
          normalizeLabel(o.label).includes(normalizeLabel(searchQuery))
        )
      : options

  // ── Portal positioning (mirrors DateRangeFilter) ──────────────────────────

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverHeight = 300 // conservative estimate for the dropdown
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight
    setPos({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      placeAbove,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPosReady(false)
      setRevealed(false)
      return
    }
    updatePos()
    setPosReady(true)
    window.addEventListener("scroll", updatePos, true)
    window.addEventListener("resize", updatePos)
    return () => {
      window.removeEventListener("scroll", updatePos, true)
      window.removeEventListener("resize", updatePos)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!posReady) return
    setRevealed(true)
  }, [posReady])

  // ─────────────────────────────────────────────────────────────────────────

  const openDropdown = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setSearchQuery("")
    setFocusedIndex(0)
  }, [disabled])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setFocusedIndex(-1)
    setSearchQuery("")
    triggerRef.current?.focus()
  }, [])

  const toggleOption = useCallback(
    (optValue: string) => {
      if (values.includes(optValue)) {
        onChange(values.filter((v) => v !== optValue))
      } else {
        onChange([...values, optValue])
      }
      // Do NOT close the popover — allow multiple selections.
    },
    [values, onChange]
  )

  const clearAll = useCallback(() => {
    onChange([])
  }, [onChange])

  const selectAll = useCallback(() => {
    onChange(
      Array.from(
        new Set([
          ...values,
          ...filteredOptions.filter((o) => !o.disabled).map((o) => o.value),
        ])
      )
    )
    // Do NOT close the popover — same behavior as toggleOption.
  }, [values, filteredOptions, onChange])

  // Close on outside click (check trigger + portal popover separately)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (
        !triggerRef.current?.contains(t) &&
        !popoverRef.current?.contains(t)
      ) {
        closeDropdown()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, closeDropdown])

  // Auto-focus the search input when the dropdown opens (showSearch only).
  useEffect(() => {
    if (open && showSearch) {
      searchRef.current?.focus()
    }
  }, [open, showSearch])

  // Focus list item when focusedIndex changes (only when search input is not active).
  useEffect(() => {
    if (!open || focusedIndex < 0) return
    if (showSearch && document.activeElement === searchRef.current) return
    const items = listRef.current?.querySelectorAll<HTMLLIElement>("[role='option']")
    items?.[focusedIndex]?.focus()
  }, [open, focusedIndex, showSearch])

  // When the search query changes, reset focusedIndex to the first result.
  useEffect(() => {
    if (!open || !showSearch) return
    setFocusedIndex(filteredOptions.length > 0 ? 0 : -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault()
      openDropdown()
    }
    if (e.key === "Escape") closeDropdown()
  }

  function handleOptionKeyDown(e: React.KeyboardEvent, idx: number) {
    const list = filteredOptions
    const enabledIdxs = list
      .map((o, i) => (!o.disabled ? i : null))
      .filter((i): i is number => i !== null)

    const currentEnabledPos = enabledIdxs.indexOf(idx)

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (!list[idx].disabled) toggleOption(list[idx].value)
    }
    if (e.key === "Escape") {
      e.preventDefault()
      closeDropdown()
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = enabledIdxs[currentEnabledPos + 1] ?? enabledIdxs[0]
      if (next !== undefined) setFocusedIndex(next)
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (currentEnabledPos === 0 && showSearch) {
        searchRef.current?.focus()
        return
      }
      const prev =
        enabledIdxs[currentEnabledPos - 1] ??
        enabledIdxs[enabledIdxs.length - 1]
      if (prev !== undefined) setFocusedIndex(prev)
    }
    if (e.key === "Home") {
      e.preventDefault()
      if (enabledIdxs.length) setFocusedIndex(enabledIdxs[0])
    }
    if (e.key === "End") {
      e.preventDefault()
      if (enabledIdxs.length) setFocusedIndex(enabledIdxs[enabledIdxs.length - 1])
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      closeDropdown()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const enabledIdxs = filteredOptions
        .map((o, i) => (!o.disabled ? i : null))
        .filter((i): i is number => i !== null)
      if (enabledIdxs.length) {
        setFocusedIndex(enabledIdxs[0])
        const items = listRef.current?.querySelectorAll<HTMLLIElement>("[role='option']")
        items?.[enabledIdxs[0]]?.focus()
      }
      return
    }
    if (e.key === "Enter") {
      // Toggle the first enabled filtered option on Enter.
      const first = filteredOptions.find((o) => !o.disabled)
      if (first) toggleOption(first.value)
    }
  }

  // Trigger label: show count when selections exist, placeholder when empty.
  const selectedCount = values.length
  const selectedOptions = options.filter((o) => values.includes(o.value))

  // "Seleccionar todos" only makes sense while some visible, enabled option
  // is still unselected — hide it once everything visible is already checked.
  const canSelectAll = filteredOptions.some(
    (o) => !o.disabled && !values.includes(o.value)
  )

  function renderTriggerContent() {
    if (selectedCount === 0) {
      return (
        <span className="truncate text-muted-foreground">{placeholder}</span>
      )
    }
    // Single line, always contained: first selection + "+N" overflow badge.
    // (Avoids flex-wrap inside the fixed-height trigger, which used to spill
    // the wrapped line above/below the button and cover neighboring labels.)
    const first = selectedOptions[0]
    const overflow = selectedCount - 1
    return (
      <span className="flex items-center gap-1.5 flex-1 min-w-0">
        {first?.leading && (
          <span className="flex items-center shrink-0">{first.leading}</span>
        )}
        <span className="truncate">{first?.label}</span>
        {overflow > 0 && (
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
            +{overflow}
          </span>
        )}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-multiselectable="true"
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 h-9 px-3 rounded-lg",
          "bg-background border text-sm text-left cursor-pointer select-none",
          "transition-colors duration-150",
          "border-input",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
          "hover:border-ring/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30",
          triggerClassName
        )}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {renderTriggerContent()}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selectedCount > 0 && (
            <span
              role="button"
              aria-label="Limpiar selección"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                clearAll()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  clearAll()
                }
              }}
              className="flex items-center justify-center h-4 w-4 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="h-3 w-3" aria-hidden />
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </span>
      </button>

      {/* Portal popover */}
      {mounted && open && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel ?? "Opciones"}
          className={cn(
            "fixed z-[200] rounded-lg border border-border/80",
            "bg-popover text-popover-foreground shadow-lg",
            "transition-[opacity,scale] duration-[150ms] ease-out motion-reduce:transition-none",
            revealed ? "opacity-100 scale-100" : "opacity-0 scale-[0.97] pointer-events-none",
            pos.placeAbove ? "origin-bottom" : "origin-top",
          )}
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            transform: pos.placeAbove ? "translateY(-100%)" : undefined,
          }}
        >
          {/* Search input */}
          {showSearch && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
              <SearchIcon
                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="text"
                role="searchbox"
                aria-label="Buscar opción"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto"
          >
            {filteredOptions.length === 0 ? (
              <li
                role="presentation"
                className="px-3 py-3 text-sm text-muted-foreground text-center select-none"
              >
                Sin resultados
              </li>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = values.includes(option.value)
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    tabIndex={option.disabled ? -1 : 0}
                    onClick={() => !option.disabled && toggleOption(option.value)}
                    onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none",
                      "transition-colors duration-100 outline-none",
                      !option.disabled &&
                        "hover:bg-accent/10 focus:bg-accent/10",
                      isSelected && "font-medium text-primary",
                      option.disabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {/* Checkbox indicator */}
                    <span
                      className={cn(
                        "flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-background"
                      )}
                      aria-hidden
                    >
                      {isSelected && (
                        <CheckIcon className="h-2.5 w-2.5" aria-hidden />
                      )}
                    </span>
                    {option.leading && (
                      <span className="flex items-center shrink-0">
                        {option.leading}
                      </span>
                    )}
                    <span className="flex-1 truncate">{option.label}</span>
                  </li>
                )
              })
            )}
          </ul>

          {/* Footer: Seleccionar todos / Limpiar actions */}
          {(canSelectAll || values.length > 0) && (
            <div className="flex items-center gap-3 border-t border-border/60 px-3 py-1.5">
              {canSelectAll && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Seleccionar todos
                </button>
              )}
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
