-- =============================================================
-- 0038_weekly_insights_pref.sql
-- Opt-in para el resumen semanal de insights de Manguito (push + email).
-- Default OFF: nadie recibe notificaciones que no pidió explícitamente.
-- =============================================================
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS weekly_insights_enabled boolean NOT NULL DEFAULT false;
