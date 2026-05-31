"use client"

import { cn } from "@/lib/utils"

interface SwitchProps {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
  id?: string
}

/**
 * Simple toggle switch built on a native checkbox.
 * Styled to match the design system (lime primary).
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm",
          "transform transition-transform duration-150 ease-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  )
}
