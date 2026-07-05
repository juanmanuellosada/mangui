-- =============================================================
-- 0054_accounts_card_cycle_dates.sql
-- Cambia el ancla del ciclo de tarjeta de "día del mes" (closing_day/
-- due_day, int) a "fecha completa" (closing_date/due_date, date).
--
-- Motivo: el usuario elige una fecha concreta en el date-picker (no un
-- número de día), y esperaba que se guardara y mostrara exactamente esa
-- fecha. El ciclo se sigue proyectando mes a mes igual que antes (el "día
-- efectivo" sale de EXTRACT(DAY FROM closing_date/due_date)) — no hace
-- falta modelar fechas irregulares por mes, eso ya lo maneja cada resumen
-- en card_statements y el import editable.
--
-- Decisión: closing_day/due_day NO se eliminan. Se convierten en columnas
-- GENERATED derivadas de closing_date/due_date (EXTRACT(DAY FROM ...)),
-- así cualquier lector que todavía consulte closing_day/due_day (ej.
-- dashboard/accounts-preview.tsx, que solo los usa para mostrar "Cierre 20")
-- sigue funcionando sin cambios. La app (cards.ts y consumidores) pasa a
-- anclar el cálculo de ciclos en closing_date/due_date.
-- Reversible: para volver atrás, dropear closing_date/due_date y
-- reconvertir closing_day/due_day en columnas normales con su valor actual.
-- =============================================================

-- 1) Nuevas columnas: fecha completa del cierre/vencimiento.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closing_date date NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_date date NULL;

-- 2) Backfill: closing_date = próximo cierre (>= hoy AR) según el
-- closing_day existente; due_date = vencimiento correspondiente a ese
-- cierre según due_day. Réplica exacta de nextCloseDate/computeDueDate
-- (src/lib/cards.ts) para que el dato migrado coincida con lo que la app
-- ya calculaba y mostraba.
CREATE OR REPLACE FUNCTION _0054_next_close_date(p_day int, p_today date)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  v_this_month_last_day int;
  v_this_month_close date;
  v_next_month date;
  v_next_month_last_day int;
BEGIN
  v_this_month_last_day := EXTRACT(DAY FROM (date_trunc('month', p_today) + interval '1 month' - interval '1 day'))::int;
  v_this_month_close := make_date(EXTRACT(YEAR FROM p_today)::int, EXTRACT(MONTH FROM p_today)::int, LEAST(p_day, v_this_month_last_day));

  IF v_this_month_close >= p_today THEN
    RETURN v_this_month_close;
  END IF;

  v_next_month := (date_trunc('month', p_today) + interval '1 month')::date;
  v_next_month_last_day := EXTRACT(DAY FROM (v_next_month + interval '1 month' - interval '1 day'))::int;
  RETURN make_date(EXTRACT(YEAR FROM v_next_month)::int, EXTRACT(MONTH FROM v_next_month)::int, LEAST(p_day, v_next_month_last_day));
END;
$$;

CREATE OR REPLACE FUNCTION _0054_compute_due_date(p_close date, p_due_day int, p_closing_day int)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  v_due_month date;
  v_due_month_last_day int;
BEGIN
  IF p_due_day > p_closing_day THEN
    v_due_month := date_trunc('month', p_close)::date;
  ELSE
    v_due_month := (date_trunc('month', p_close) + interval '1 month')::date;
  END IF;
  v_due_month_last_day := EXTRACT(DAY FROM (v_due_month + interval '1 month' - interval '1 day'))::int;
  RETURN make_date(EXTRACT(YEAR FROM v_due_month)::int, EXTRACT(MONTH FROM v_due_month)::int, LEAST(p_due_day, v_due_month_last_day));
END;
$$;

DO $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  UPDATE accounts
  SET closing_date = _0054_next_close_date(closing_day, v_today)
  WHERE type = 'tarjeta_credito' AND closing_day IS NOT NULL;

  UPDATE accounts
  SET due_date = _0054_compute_due_date(closing_date, due_day, closing_day)
  WHERE type = 'tarjeta_credito'
    AND closing_day IS NOT NULL
    AND due_day IS NOT NULL
    AND closing_date IS NOT NULL;
END $$;

DROP FUNCTION _0054_next_close_date(int, date);
DROP FUNCTION _0054_compute_due_date(date, int, int);

-- 3) closing_day/due_day pasan a ser columnas derivadas (GENERATED) de
-- closing_date/due_date, solo para no romper lectores existentes que
-- todavía muestren el día como número. Postgres no permite agregar
-- GENERATED a una columna existente con ALTER COLUMN, así que se dropea y
-- se vuelve a crear (drop también se lleva el CHECK BETWEEN 1 AND 31 de
-- 0003, que ahora es redundante: un date siempre tiene un día válido).
ALTER TABLE accounts DROP COLUMN closing_day;
ALTER TABLE accounts ADD COLUMN closing_day int GENERATED ALWAYS AS (EXTRACT(DAY FROM closing_date)::int) STORED;

ALTER TABLE accounts DROP COLUMN due_day;
ALTER TABLE accounts ADD COLUMN due_day int GENERATED ALWAYS AS (EXTRACT(DAY FROM due_date)::int) STORED;
