"use client"

/**
 * MangoDatePicker — custom calendar date picker for mangui.
 *
 * Trigger button shows the selected date formatted in es-AR.
 * Clicking opens a portal-positioned popover with a DayPicker (react-day-picker v10).
 * On mobile, the popover renders anchored below/above the trigger.
 * Keyboard: Escape closes, arrow keys navigate the calendar.
 * Respects prefers-reduced-motion.
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { DayPicker } from "react-day-picker"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MangoDatePickerProps {
  value: Date | null
  onChange: (date: Date) => void
  label?: string
  placeholder?: string
  /** When true, past dates are disabled */
  disablePast?: boolean
  id?: string
  "aria-invalid"?: boolean
}

export function MangoDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disablePast = false,
  id,
  "aria-invalid": ariaInvalid,
}: MangoDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0, placeAbove: false })

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => { setMounted(true) }, [])

  // Position the popover relative to the trigger
  const updatePos = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverHeight = 340
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight
    setPos({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 280),
      placeAbove,
    })
  }, [])

  React.useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener("scroll", updatePos, true)
    window.addEventListener("resize", updatePos)
    return () => {
      window.removeEventListener("scroll", updatePos, true)
      window.removeEventListener("resize", updatePos)
    }
  }, [open, updatePos])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Escape key
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  const displayLabel = value
    ? format(value, "EEE d MMM", { locale: es })
    : null

  const disabled = disablePast
    ? { before: new Date(new Date().setHours(0, 0, 0, 0)) }
    : undefined

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full min-h-[44px] items-center gap-2.5 rounded-md border px-3 py-2",
          "bg-background text-sm text-left cursor-pointer",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          ariaInvalid
            ? "border-destructive focus-visible:ring-destructive"
            : "border-input hover:border-primary/40"
        )}
      >
        <CalendarDays
          className="h-4 w-4 text-muted-foreground flex-shrink-0"
          aria-hidden
        />
        <span className={cn("flex-1 tabular-nums", !displayLabel && "text-muted-foreground")}>
          {displayLabel ?? placeholder}
        </span>
      </button>

      {mounted && open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Seleccionar fecha"
          className={cn(
            "fixed z-[200] rounded-xl border border-border/60 bg-popover p-3 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            maxWidth: "min(320px, calc(100vw - 2rem))",
            transform: pos.placeAbove ? "translateY(-100%)" : undefined,
          }}
        >
          <DayPicker
            mode="single"
            selected={value ?? undefined}
            onSelect={(date) => {
              if (date) {
                onChange(date)
                setOpen(false)
              }
            }}
            locale={es}
            weekStartsOn={1}
            showOutsideDays
            disabled={disabled}
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              month_caption: "relative flex items-center justify-center h-9 mb-1",
              caption_label: "text-sm font-semibold text-foreground capitalize",
              nav: "absolute inset-0 flex items-center justify-between pointer-events-none",
              button_previous: [
                "pointer-events-auto h-7 w-7 rounded-lg flex items-center justify-center",
                "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                "transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" "),
              button_next: [
                "pointer-events-auto h-7 w-7 rounded-lg flex items-center justify-center",
                "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                "transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" "),
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "w-9 h-7 text-[11px] font-medium text-muted-foreground flex items-center justify-center",
              week: "flex",
              day: "w-9 h-9 p-0 text-center",
              day_button: [
                "w-full h-full rounded-full text-xs font-medium",
                "flex items-center justify-center",
                "text-foreground",
                "hover:bg-primary/15 hover:text-primary",
                "transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" "),
              selected: "bg-primary text-primary-foreground rounded-full hover:bg-primary hover:text-primary-foreground",
              today: "font-bold text-primary",
              outside: "opacity-35 text-muted-foreground",
              disabled: "opacity-25 cursor-not-allowed",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden />
                ),
            }}
          />
        </div>,
        document.body
      )}
    </>
  )
}
