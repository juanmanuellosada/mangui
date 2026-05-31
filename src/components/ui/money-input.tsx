"use client"

/**
 * MoneyInput — controlled numeric amount input without native spinners.
 *
 * Behaviour:
 * - Hides native spinner buttons (appearance:textfield + webkit pseudo-elements via inline style)
 * - Prevents mouse-wheel from changing value (blurs on wheel)
 * - Prevents Up/Down arrow keys from incrementing the value
 * - Sets inputMode="decimal" for mobile numeric keyboard
 * - Optionally renders a left currency prefix adornment ($ for ARS, US$ for USD)
 *   with dynamic paddingLeft so text never overlaps the prefix
 *
 * Props:
 *   currency?: "ARS" | "USD"  — renders "$" or "US$" prefix on the left
 *   prefix?: string           — override prefix text (if currency not provided)
 *   className?, id?, placeholder?, value?, onChange?, onBlur?, disabled?
 *   ...rest forwarded to <input>
 *
 * RHF / Zod coercion note: keep type="number" so z.coerce.number() works as before.
 * The component passes through all ...rest props including those from register().
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  currency?: "ARS" | "USD"
  prefix?: string
  /** Extra className for the wrapper div */
  wrapperClassName?: string
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    { currency, prefix, className, wrapperClassName, style, ...rest },
    ref
  ) {
    const resolvedPrefix =
      prefix !== undefined
        ? prefix
        : currency === "USD"
        ? "US$"
        : currency === "ARS"
        ? "$"
        : undefined

    const hasPrefix = resolvedPrefix !== undefined
    // US$ is wider than $
    const prefixIsWide = resolvedPrefix === "US$"

    // paddingLeft: wide prefix needs a bit more space
    const paddingLeft = hasPrefix
      ? prefixIsWide
        ? "2.75rem"
        : "2rem"
      : undefined

    function handleWheel(e: React.WheelEvent<HTMLInputElement>) {
      e.currentTarget.blur()
      rest.onWheel?.(e)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault()
      }
      rest.onKeyDown?.(e)
    }

    const inputStyle: React.CSSProperties = {
      // Suppress native spinner
      appearance: "textfield" as React.CSSProperties["appearance"],
      MozAppearance: "textfield",
      WebkitAppearance: "none",
      // Dynamic left padding when prefix present
      ...(paddingLeft ? { paddingLeft } : {}),
      ...style,
    }

    return (
      <div className={cn("relative flex items-center", wrapperClassName)}>
        {hasPrefix && (
          <span
            className={cn(
              "absolute left-3 select-none text-sm font-medium text-muted-foreground pointer-events-none z-10 tabular-nums",
              "transition-opacity duration-100"
            )}
            aria-hidden
          >
            {resolvedPrefix}
          </span>
        )}
        {/* eslint-disable-next-line react/no-unknown-property */}
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          className={cn(
            // Base Input styles mirroring shadcn Input
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          style={inputStyle}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          {...rest}
        />
      </div>
    )
  }
)

MoneyInput.displayName = "MoneyInput"
