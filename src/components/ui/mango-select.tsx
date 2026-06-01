"use client"

/**
 * MangoSelect — bespoke dropdown component for mangui.
 * NOT a native <select>, NOT base-ui/radix Select.
 * Custom trigger + animated popover list, keyboard accessible,
 * lime focus ring, hairline border, rounded per DESIGN.md, light+dark.
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Normalize a string: lowercase + strip diacritics. */
function normalizeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export interface MangoSelectOption {
  value: string
  label: string
  /** Optional leading node: flag emoji, lucide icon, etc. */
  leading?: React.ReactNode
  disabled?: boolean
}

export interface MangoSelectProps {
  /** Controlled value */
  value: string
  onChange: (value: string) => void
  options: MangoSelectOption[]
  placeholder?: string
  className?: string
  /** Additional class for the trigger button */
  triggerClassName?: string
  disabled?: boolean
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  /**
   * When true, renders a search input at the top of the open popover.
   * The input is auto-focused and filters options by label (case- and
   * accent-insensitive). Default: false — no change to existing behavior.
   */
  showSearch?: boolean
}

export function MangoSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccioná…",
  className,
  triggerClassName,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  showSearch = false,
}: MangoSelectProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [searchQuery, setSearchQuery] = useState("")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  // When showSearch is active, filter by normalized label; otherwise use all options.
  const filteredOptions = showSearch && searchQuery
    ? options.filter((o) =>
        normalizeLabel(o.label).includes(normalizeLabel(searchQuery))
      )
    : options

  const openDropdown = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setSearchQuery("")
    const idx = options.findIndex((o) => o.value === value)
    setFocusedIndex(idx >= 0 ? idx : 0)
  }, [disabled, options, value])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setFocusedIndex(-1)
    setSearchQuery("")
    triggerRef.current?.focus()
  }, [])

  const selectOption = useCallback(
    (optValue: string) => {
      onChange(optValue)
      closeDropdown()
    },
    [onChange, closeDropdown]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    // If the search input is focused, don't steal focus away from it.
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

  /**
   * handleOptionKeyDown operates over filteredOptions (the rendered list).
   * `idx` is the index within filteredOptions.
   */
  function handleOptionKeyDown(e: React.KeyboardEvent, idx: number) {
    const list = filteredOptions
    const enabledIdxs = list
      .map((o, i) => (!o.disabled ? i : null))
      .filter((i): i is number => i !== null)

    const currentEnabledPos = enabledIdxs.indexOf(idx)

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (!list[idx].disabled) selectOption(list[idx].value)
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
      // ArrowUp from first item: move focus back to the search input (if showSearch).
      if (currentEnabledPos === 0 && showSearch) {
        searchRef.current?.focus()
        return
      }
      const prev =
        enabledIdxs[currentEnabledPos - 1] ?? enabledIdxs[enabledIdxs.length - 1]
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

  /** Key handler for the search input. Only handles navigation keys; typing falls through naturally. */
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      closeDropdown()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      // Move focus into the list at the first enabled item.
      const enabledIdxs = filteredOptions
        .map((o, i) => (!o.disabled ? i : null))
        .filter((i): i is number => i !== null)
      if (enabledIdxs.length) {
        setFocusedIndex(enabledIdxs[0])
        // Immediately focus the element — the useEffect won't fire because
        // activeElement is still the input at that point.
        const items = listRef.current?.querySelectorAll<HTMLLIElement>("[role='option']")
        items?.[enabledIdxs[0]]?.focus()
      }
      return
    }
    if (e.key === "Enter") {
      // Select the first enabled filtered option on Enter.
      const first = filteredOptions.find((o) => !o.disabled)
      if (first) selectOption(first.value)
    }
  }

  // Popover position: place below trigger, flip if near bottom
  const [dropUp, setDropUp] = useState(false)
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setDropUp(spaceBelow < 220)
  }, [open])

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          // Base
          "flex w-full items-center justify-between gap-2 h-9 px-3 rounded-lg",
          "bg-background border text-sm text-left cursor-pointer select-none",
          "transition-colors duration-150",
          // Border: hairline, subtle
          "border-input",
          // Focus ring
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
          // Invalid state
          ariaInvalid && "border-destructive focus-visible:ring-destructive/40",
          // Hover
          "hover:border-ring/60",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Dark mode bg adjustment
          "dark:bg-input/30",
          triggerClassName
        )}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption?.leading && (
            <span className="flex items-center shrink-0">{selectedOption.leading}</span>
          )}
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-muted-foreground"
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute z-50 w-full",
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          <div
            className={cn(
              "rounded-lg border border-border/80",
              "bg-popover text-popover-foreground shadow-lg",
              // Animation
              "animate-in fade-in-0 zoom-in-95 duration-150",
              dropUp ? "origin-bottom" : "origin-top"
            )}
          >
            {/* Search input — only rendered when showSearch=true */}
            {showSearch && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                <SearchIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
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
                  className={cn(
                    "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                  )}
                />
              </div>
            )}
            <ul
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel ?? "Opciones"}
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
                  const isSelected = option.value === value
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      tabIndex={option.disabled ? -1 : 0}
                      onClick={() => !option.disabled && selectOption(option.value)}
                      onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none",
                        "transition-colors duration-100 outline-none",
                        // Hover / focus
                        !option.disabled &&
                          "hover:bg-accent/10 focus:bg-accent/10",
                        // Selected
                        isSelected && "font-semibold text-primary",
                        // Disabled
                        option.disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {option.leading && (
                        <span className="flex items-center shrink-0">{option.leading}</span>
                      )}
                      <span className="flex-1 truncate">{option.label}</span>
                      {isSelected && (
                        <CheckIcon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
