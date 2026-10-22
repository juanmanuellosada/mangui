-- Modo aditivo: las filas existentes siguen usando su límite fijo.
-- Se conserva limit_amount (y su CHECK positivo) al cambiar de modo.
ALTER TABLE public.budgets
  ADD COLUMN limit_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN income_percentage numeric(5,2),
  ADD CONSTRAINT budgets_limit_mode_check
    CHECK (limit_mode IN ('fixed', 'percentage')),
  ADD CONSTRAINT budgets_income_percentage_check
    CHECK (income_percentage IS NULL OR income_percentage BETWEEN 0.01 AND 100),
  ADD CONSTRAINT budgets_percentage_required_check
    CHECK (limit_mode <> 'percentage' OR income_percentage IS NOT NULL);

COMMENT ON COLUMN public.budgets.limit_mode IS
  'fixed: límite monetario. percentage: porcentaje de ingresos registrados del período, en las cuentas y moneda del presupuesto.';
COMMENT ON COLUMN public.budgets.income_percentage IS
  'Porcentaje de ingresos (0,01 a 100). No se filtran ingresos por categorías de gasto. Sin ingresos no hay límite calculable.';
