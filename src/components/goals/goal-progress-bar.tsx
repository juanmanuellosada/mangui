import { cn } from "@/lib/utils"
import type { GoalProgressStatus } from "@/lib/goals"

interface GoalProgressBarProps {
  /** Real percent value (may be negative for saving goals with negative net). */
  percent: number
  status: GoalProgressStatus
  /** Optional label appended after the percentage (e.g. "alcanzado"). */
  label?: string
  className?: string
}

const BAR_COLOR: Record<GoalProgressStatus, string> = {
  on_track: "bg-primary",
  near: "bg-amber-500",
  reached: "bg-success",
  exceeded: "bg-destructive",
}

/**
 * Shared progress bar for goal cards.
 *
 * - Visual bar width is clamped to [0, 100].
 * - The percentage label always shows the real value; when negative (exceeded),
 *   the label is colored destructive per the design spec.
 * - Keeps role="progressbar" + aria-valuenow/min/max for accessibility.
 */
export function GoalProgressBar({
  percent,
  status,
  label,
  className,
}: GoalProgressBarProps) {
  const visualWidth = Math.min(Math.max(percent, 0), 100)
  const isNegative = percent < 0

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="h-2 rounded-full bg-border overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(visualWidth)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            BAR_COLOR[status]
          )}
          style={{ width: `${visualWidth}%` }}
        />
      </div>
      <p
        className={cn(
          "text-[11px] tabular-nums",
          isNegative ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {percent.toFixed(0)}%{label ? ` ${label}` : ""}
      </p>
    </div>
  )
}
