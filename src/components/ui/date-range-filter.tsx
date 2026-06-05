"use client"

/**
 * DateRangeFilter — controlled date-range filter with operator, presets,
 * "últimos N" and a react-day-picker calendar.
 *
 * - Popover portals to document.body (same pattern as MangoDatePicker) so it
 *   is never clipped by scroll containers.
 * - Deferred confirm: draft state is kept internally; onChange is only called
 *   on Aplicar. Cancelar and Escape discard the draft and close.
 * - Fully independent of Movimientos — generic controlled API.
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { DayPicker } from "react-day-picker"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PRESETS,
  getPreset,
  lastN,
  type PresetKey,
  type LastNUnit,
  type DateRange,
} from "@/lib/date-ranges"

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRangeOperator = "is" | "before" | "after" | "between"

export interface DateRangeValue {
  operator: DateRangeOperator
  preset?: PresetKey
  lastN?: { n: number; unit: LastNUnit }
  /** Single date for is / before / after (ISO yyyy-MM-dd) */
  date?: string | null
  /** Normalized lower bound for querying */
  from: string | null
  /** Normalized upper bound for querying */
  to: string | null
  /** Human-readable summary shown in the trigger */
  label: string
}

interface Props {
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
  id?: string
  /** Additional classes applied to the trigger button */
  triggerClassName?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize operator + date(s) into from/to query bounds. */
function normalize(
  operator: DateRangeOperator,
  date: string | null | undefined,
  rangeFrom: string | null,
  rangeTo: string | null,
  preset: PresetKey | undefined,
  lastn: { n: number; unit: LastNUnit } | undefined,
  label: string,
): DateRangeValue {
  if (preset) {
    const r = getPreset(preset)
    return { operator: "between", preset, from: r.from, to: r.to, label: r.label }
  }
  if (lastn) {
    const r = lastN(lastn.n, lastn.unit)
    return { operator: "between", lastN: lastn, from: r.from, to: r.to, label: r.label }
  }
  switch (operator) {
    case "is":
      return { operator, date, from: date ?? null, to: date ?? null, label }
    case "before":
      return { operator, date, from: null, to: date ?? null, label }
    case "after":
      return { operator, date, from: date ?? null, to: null, label }
    case "between":
      return { operator, from: rangeFrom, to: rangeTo, label }
  }
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "…"
  return format(parseISO(iso), "dd-MM-yyyy")
}

function buildLabel(
  operator: DateRangeOperator,
  date: string | null | undefined,
  rangeFrom: string | null,
  rangeTo: string | null,
): string {
  switch (operator) {
    case "is":
      return `es ${formatDisplayDate(date)}`
    case "before":
      return `antes de ${formatDisplayDate(date)}`
    case "after":
      return `después de ${formatDisplayDate(date)}`
    case "between":
      return `entre ${formatDisplayDate(rangeFrom)} y ${formatDisplayDate(rangeTo)}`
  }
}

/** Default initial value — all_time (no date filter). */
export function defaultDateRange(): DateRangeValue {
  const r = getPreset("all_time")
  return { operator: "between", preset: "all_time", from: r.from, to: r.to, label: r.label }
}

// ─── Operator options ─────────────────────────────────────────────────────────

const OPERATOR_OPTIONS: { value: DateRangeOperator; label: string }[] = [
  { value: "is", label: "es" },
  { value: "before", label: "es antes de" },
  { value: "after", label: "es después de" },
  { value: "between", label: "está entre" },
]

// ─── Draft state ──────────────────────────────────────────────────────────────

interface DraftState {
  operator: DateRangeOperator
  preset: PresetKey | undefined
  lastn: { n: number; unit: LastNUnit } | undefined
  /** Single date for is/before/after */
  singleDate: Date | undefined
  /** Range for "between" when not using a preset */
  rangeFrom: Date | undefined
  rangeTo: Date | undefined
  /** lastN inputs (editable string) */
  lastNInput: string
  lastNUnit: LastNUnit
}

function draftFromValue(v: DateRangeValue): DraftState {
  const parseD = (iso: string | null | undefined): Date | undefined => {
    if (!iso) return undefined
    try { return parseISO(iso) } catch { return undefined }
  }

  if (v.preset) {
    return {
      operator: "between",
      preset: v.preset,
      lastn: undefined,
      singleDate: undefined,
      rangeFrom: parseD(v.from),
      rangeTo: parseD(v.to),
      lastNInput: "30",
      lastNUnit: "days",
    }
  }

  if (v.lastN) {
    return {
      operator: "between",
      preset: undefined,
      lastn: v.lastN,
      singleDate: undefined,
      rangeFrom: parseD(v.from),
      rangeTo: parseD(v.to),
      lastNInput: String(v.lastN.n),
      lastNUnit: v.lastN.unit,
    }
  }

  return {
    operator: v.operator,
    preset: undefined,
    lastn: undefined,
    singleDate: parseD(v.operator !== "between" ? v.date : undefined),
    rangeFrom: v.operator === "between" ? parseD(v.from) : undefined,
    rangeTo: v.operator === "between" ? parseD(v.to) : undefined,
    lastNInput: "30",
    lastNUnit: "days",
  }
}

// ─── Calendar class names (reused from MangoDatePicker) ───────────────────────

const DAY_PICKER_CLASSNAMES = {
  months: "flex flex-col",
  month: "relative space-y-2",
  month_caption: "flex items-center justify-center h-9 mb-1 px-9",
  caption_label: "text-sm font-semibold text-foreground capitalize",
  nav: "absolute top-0 inset-x-0 h-9 flex items-center justify-between pointer-events-none",
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
  range_start: "bg-primary text-primary-foreground rounded-l-full hover:bg-primary hover:text-primary-foreground",
  range_end: "bg-primary text-primary-foreground rounded-r-full hover:bg-primary hover:text-primary-foreground",
  range_middle: "bg-primary/15 text-foreground rounded-none",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateRangeFilter({ value, onChange, id, triggerClassName }: Props) {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [pos, setPos] = React.useState({ top: 0, left: 0, placeAbove: false })
  const [posReady, setPosReady] = React.useState(false)
  const [revealed, setRevealed] = React.useState(false)

  // Draft state — mutated while popover is open; only committed on Aplicar
  const [draft, setDraft] = React.useState<DraftState>(() => draftFromValue(value))

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => { setMounted(true) }, [])

  // ── Positioning (portal to body, same pattern as MangoDatePicker) ──

  const updatePos = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverHeight = 480
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight
    setPos({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left: rect.left,
      placeAbove,
    })
  }, [])

  React.useLayoutEffect(() => {
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

  React.useEffect(() => {
    if (!posReady) return
    setRevealed(true)
  }, [posReady])

  // ── Open / close ──

  function openPopover() {
    setDraft(draftFromValue(value))
    setOpen(true)
  }

  function closeCancel() {
    setOpen(false)
  }

  function closeApply() {
    // Build the committed value from current draft
    let out: DateRangeValue

    if (draft.preset) {
      const r = getPreset(draft.preset)
      out = { operator: "between", preset: draft.preset, from: r.from, to: r.to, label: r.label }
    } else if (draft.lastn) {
      const r = lastN(draft.lastn.n, draft.lastn.unit)
      out = { operator: "between", lastN: draft.lastn, from: r.from, to: r.to, label: r.label }
    } else {
      const isoSingle = draft.singleDate ? format(draft.singleDate, "yyyy-MM-dd") : null
      const isoFrom = draft.rangeFrom ? format(draft.rangeFrom, "yyyy-MM-dd") : null
      const isoTo = draft.rangeTo ? format(draft.rangeTo, "yyyy-MM-dd") : null
      const label = buildLabel(draft.operator, isoSingle, isoFrom, isoTo)
      out = normalize(draft.operator, isoSingle, isoFrom, isoTo, undefined, undefined, label)
    }

    onChange(out)
    setOpen(false)
  }

  // ── Keyboard / outside-click ──

  React.useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        closeCancel()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeCancel()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  // ── Draft mutations ──

  function setOperator(op: DateRangeOperator) {
    setDraft((d) => ({
      ...d,
      operator: op,
      preset: undefined,
      lastn: undefined,
    }))
  }

  function selectPreset(key: PresetKey) {
    setDraft((d) => ({
      ...d,
      preset: key,
      lastn: undefined,
      operator: "between",
    }))
  }

  function applyLastN() {
    const n = parseInt(draft.lastNInput, 10)
    if (!n || n <= 0) return
    setDraft((d) => ({
      ...d,
      preset: undefined,
      lastn: { n, unit: d.lastNUnit },
    }))
  }

  // ── Calendar selection ──

  const isSingleMode = draft.operator === "is" || draft.operator === "before" || draft.operator === "after"
  const isRangeMode = draft.operator === "between" && !draft.preset && !draft.lastn

  // ── Render ──

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPopover}
        className={cn(
          "flex min-h-[36px] items-center gap-2 rounded-md border border-input px-3 py-1.5",
          "bg-background text-sm text-left cursor-pointer",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "hover:border-primary/40",
          open && "border-primary/40",
          triggerClassName,
        )}
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
        <span className="flex-1 min-w-0 truncate text-foreground">{value.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {/* Portal popover */}
      {mounted && open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Filtro de fecha"
          className={cn(
            "fixed z-[200] rounded-xl border border-border/60 bg-popover shadow-lg",
            "transition-[opacity,scale] duration-[150ms] ease-out motion-reduce:transition-none",
            revealed ? "opacity-100 scale-100" : "opacity-0 scale-[0.97] pointer-events-none",
          )}
          style={{
            top: pos.top,
            left: pos.left,
            width: "max-content",
            maxWidth: "min(640px, calc(100vw - 2rem))",
            transform: pos.placeAbove ? "translateY(-100%)" : undefined,
            transformOrigin: pos.placeAbove ? "bottom left" : "top left",
          }}
        >
          {/* Two-column layout: LEFT controls + RIGHT calendar */}
          <div className="flex">
            {/* ── LEFT column ── */}
            <div className="flex flex-col gap-3 p-4 w-52 border-r border-border/40">
              {/* Operator dropdown */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Condición
                </p>
                <div className="flex flex-col gap-0.5">
                  {OPERATOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOperator(opt.value)}
                      className={cn(
                        "w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors duration-100",
                        draft.operator === opt.value && !draft.preset && !draft.lastn
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground hover:bg-muted/60",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-border/40" />

              {/* Presets */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Período
                </p>
                <div className="flex flex-col gap-0.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => selectPreset(p.key)}
                      className={cn(
                        "w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors duration-100",
                        draft.preset === p.key
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground hover:bg-muted/60",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-border/40" />

              {/* Últimos N */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Últimos N
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={draft.lastNInput}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, lastNInput: e.target.value, preset: undefined }))
                    }
                    className={cn(
                      "w-14 rounded-md border border-input bg-background px-2 py-1 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    aria-label="Cantidad de días/semanas/meses"
                  />
                  <select
                    value={draft.lastNUnit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        lastNUnit: e.target.value as LastNUnit,
                        preset: undefined,
                      }))
                    }
                    className={cn(
                      "flex-1 rounded-md border border-input bg-background px-1.5 py-1 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    aria-label="Unidad de tiempo"
                  >
                    <option value="days">días</option>
                    <option value="weeks">semanas</option>
                    <option value="months">meses</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={applyLastN}
                  className={cn(
                    "mt-1.5 w-full text-sm rounded-md px-2 py-1",
                    "border border-input hover:border-primary/40 hover:bg-muted/40",
                    "transition-colors duration-100",
                    draft.lastn &&
                      draft.lastn.n === parseInt(draft.lastNInput, 10) &&
                      draft.lastn.unit === draft.lastNUnit
                      ? "bg-primary/10 border-primary/40 text-primary font-medium"
                      : "text-foreground",
                  )}
                >
                  Aplicar período
                </button>
              </div>
            </div>

            {/* ── RIGHT column: calendar ── */}
            <div className="flex flex-col">
              <div className="p-3 flex-1">
                {isSingleMode ? (
                  <DayPicker
                    mode="single"
                    selected={draft.singleDate}
                    onSelect={(d) =>
                      setDraft((prev) => ({ ...prev, singleDate: d, preset: undefined, lastn: undefined }))
                    }
                    locale={es}
                    weekStartsOn={1}
                    showOutsideDays
                    classNames={DAY_PICKER_CLASSNAMES}
                    components={{
                      Chevron: ({ orientation }) =>
                        orientation === "left" ? (
                          <ChevronLeft className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        ),
                    }}
                  />
                ) : (
                  <DayPicker
                    mode="range"
                    selected={
                      draft.rangeFrom || draft.rangeTo
                        ? { from: draft.rangeFrom, to: draft.rangeTo }
                        : undefined
                    }
                    onSelect={(range) => {
                      if (!range) {
                        setDraft((d) => ({ ...d, rangeFrom: undefined, rangeTo: undefined, preset: undefined, lastn: undefined }))
                        return
                      }
                      setDraft((d) => ({
                        ...d,
                        rangeFrom: range.from,
                        rangeTo: range.to,
                        preset: undefined,
                        lastn: undefined,
                      }))
                    }}
                    locale={es}
                    weekStartsOn={1}
                    showOutsideDays
                    classNames={DAY_PICKER_CLASSNAMES}
                    components={{
                      Chevron: ({ orientation }) =>
                        orientation === "left" ? (
                          <ChevronLeft className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        ),
                    }}
                  />
                )}
              </div>

              {/* Footer: Cancelar / Aplicar */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={closeCancel}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-md border border-input",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    "transition-colors duration-100",
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={closeApply}
                  className={cn(
                    "text-sm px-4 py-1.5 rounded-md",
                    "bg-primary text-primary-foreground font-medium",
                    "hover:bg-primary/90 transition-colors duration-100",
                  )}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// Re-export helpers consumers might need
export type { PresetKey, LastNUnit, DateRange }
export { PRESETS, getPreset, lastN }
