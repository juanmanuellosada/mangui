-- =============================================================
-- 0047_behavior_notif_prefs.sql
-- Columnas: user_preferences.budget_alerts_enabled, .unusual_charge_enabled
-- Depende de: 0015 (user_preferences notification columns)
--
-- Preferencias para las notificaciones push por comportamiento:
--   - alertas de presupuesto (80% / excedido)
--   - cargos inusuales vs. el promedio histórico de la categoría
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- =============================================================

-- budget_alerts_enabled: activa o desactiva los avisos de presupuesto
-- al 80% de uso o excedido. true por defecto (útil de entrada).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS budget_alerts_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_preferences.budget_alerts_enabled IS
  'Activa los avisos push cuando un presupuesto llega al 80% de uso o se excede.';

-- unusual_charge_enabled: activa o desactiva el aviso de cargo inusual
-- (gasto muy por encima del promedio histórico de su categoría).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS unusual_charge_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_preferences.unusual_charge_enabled IS
  'Activa el aviso push cuando se detecta un cargo inusualmente alto vs. el promedio de su categoría.';
