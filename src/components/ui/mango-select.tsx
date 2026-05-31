"use client"

/**
 * MangoSelect — bespoke dropdown component for mangui.
 * NOT a native <select>, NOT base-ui/radix Select.
 * Custom trigger + animated popover list, keyboard accessible,
 * lime focus ring, hairline border, rounded per DESIGN.md, light+dark.
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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
}: MangoSelectProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  const enabledOptions = options.filter((o) => !o.disabled)

  const openDropdown = useCallback(() => {
    if (disabled) return
    setOpen(true)
    const idx = options.findIndex((o) => o.value === value)
    setFocusedIndex(idx >= 0 ? idx : 0)
  }, [disabled, options, value])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setFocusedIndex(-1)
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

  // Focus list item when focusedIndex changes
  useEffect(() => {
    if (!open || focusedIndex < 0) return
    const items = listRef.current?.querySelectorAll<HTMLLIElement>("[role='option']")
    items?.[focusedIndex]?.focus()
  }, [open, focusedIndex])

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault()
      openDropdown()
    }
    if (e.key === "Escape") closeDropdown()
  }

  function handleOptionKeyDown(e: React.KeyboardEvent, idx: number) {
    const enabledIdxs = options
      .map((o, i) => (!o.disabled ? i : null))
      .filter((i): i is number => i !== null)

    const currentEnabledPos = enabledIdxs.indexOf(idx)

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (!options[idx].disabled) selectOption(options[idx].value)
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
          <ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel ?? "Opciones"}
            className={cn(
              "max-h-60 overflow-y-auto rounded-lg border border-border/80",
              "bg-popover text-popover-foreground shadow-lg",
              // Animation
              "animate-in fade-in-0 zoom-in-95 duration-150",
              dropUp ? "origin-bottom" : "origin-top"
            )}
          >
            {options.map((option, idx) => {
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
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
