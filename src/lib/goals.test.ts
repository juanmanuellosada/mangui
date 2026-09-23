import { describe, expect, it } from "vitest"
import {
  getGoalSmartGuidance,
  type Goal,
  type GoalProgress,
} from "./goals"

function savingGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    baseline_amount: null,
    created_at: "2026-01-01T00:00:00.000Z",
    currency: "ARS",
    deadline: null,
    end_date: "2026-06-30",
    icon: null,
    id: "goal-1",
    is_global: true,
    name: "Fondo de emergencia",
    period: "custom",
    recurring: false,
    start_date: "2026-01-01",
    status: "active",
    target_amount: 60000,
    target_percent: null,
    type: "saving",
    updated_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  }
}

function progress(value: number, target = 60000): GoalProgress {
  return {
    value,
    target,
    percent: (value / target) * 100,
    status: "on_track",
  }
}

describe("getGoalSmartGuidance", () => {
  it("suggests a monthly contribution for a saving goal with more than a month remaining", () => {
    const guidance = getGoalSmartGuidance(
      savingGoal(),
      progress(35000),
      new Date("2026-04-01T12:00:00")
    )

    expect(guidance).toMatchObject({
      pace: "monthly",
      suggestedContribution: 8241.76,
      remainingAmount: 25000,
      remainingDays: 91,
      status: "on_track",
    })
  })

  it("suggests a weekly contribution when the deadline is within a month", () => {
    const guidance = getGoalSmartGuidance(
      savingGoal({ end_date: "2026-05-21", target_amount: 1000 }),
      progress(300, 1000),
      new Date("2026-05-10T12:00:00")
    )

    expect(guidance).toMatchObject({
      pace: "weekly",
      suggestedContribution: 408.34,
      remainingAmount: 700,
      remainingDays: 12,
    })
  })

  it("flags progress more than 15 percentage points behind the elapsed time as at risk", () => {
    const goal = savingGoal({ end_date: "2026-01-31", target_amount: 1000 })
    const ref = new Date("2026-01-16T12:00:00")

    expect(getGoalSmartGuidance(goal, progress(360, 1000), ref)?.status).toBe("at_risk")
    expect(getGoalSmartGuidance(goal, progress(370, 1000), ref)?.status).toBe("on_track")
  })
})
