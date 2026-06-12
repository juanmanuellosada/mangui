export const PREMIUM_PRICE_ARS = 9999;
export const ANNUAL_PRICE_ARS = 99990;

export interface PlanLimits {
  accounts: number;
  budgets: number;
  goals: number;
  recurring: number;
  rules: number;
  attachments: number;
  exportCsv: boolean;
  aiPerDay: number;
}

export const FREE: PlanLimits = {
  accounts: 3,
  budgets: 3,
  goals: 3,
  recurring: 3,
  rules: 2,
  attachments: 5,
  exportCsv: false,
  aiPerDay: 10,
};

export const PREMIUM: PlanLimits = {
  accounts: Infinity,
  budgets: Infinity,
  goals: Infinity,
  recurring: Infinity,
  rules: Infinity,
  attachments: Infinity,
  exportCsv: true,
  aiPerDay: Infinity,
};

/**
 * Returns true if the profile has premium access, either through an active
 * MercadoPago subscription or a manual payment exemption.
 */
export function isPremium(p: {
  payment_exempt?: boolean | null;
  mp_subscription_status?: string | null;
}): boolean {
  return p.payment_exempt === true || p.mp_subscription_status === 'authorized';
}

export function getLimits(premium: boolean): PlanLimits {
  return premium ? PREMIUM : FREE;
}

/** Convenience object: { free, premium } — useful for displaying plan features. */
export const PLAN_LIMITS = { free: FREE, premium: PREMIUM } as const;
