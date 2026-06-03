-- Refactor de Metas — schema v2 (parte 1/2)
-- El valor de enum 'income' DEBE agregarse en su propia migración:
-- PostgreSQL no permite usar un valor de enum recién agregado en la
-- misma transacción que lo crea.
ALTER TYPE goal_type ADD VALUE IF NOT EXISTS 'income';
