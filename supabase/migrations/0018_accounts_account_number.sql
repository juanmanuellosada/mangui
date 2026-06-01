-- =============================================================
-- 0018_accounts_account_number.sql
-- Número de cuenta opcional en accounts. Versión prod: 20260531202418.
-- =============================================================

-- Número de cuenta opcional (CBU/CVU/alias/nro), no aplica a tarjetas de crédito.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number text NULL;
