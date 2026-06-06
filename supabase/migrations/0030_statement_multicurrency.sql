-- Pago multi-moneda en resúmenes de tarjeta
-- Depende de: 0010 (card_statements), 0029 (statement_attachments)
--
-- CAMBIOS:
--   1. Agrega total_amount_usd  — subtotal del resumen en USD (calculado al pagar).
--   2. Agrega paid_amount_usd   — monto efectivamente pagado en USD.
--   3. Agrega paid_from_account_id_usd — cuenta de origen del pago en USD.
--
-- CONVENCIÓN:
--   Los campos existentes (total_amount / paid_amount / paid_from_account_id)
--   representan el saldo en ARS. Los nuevos campos representan el saldo en USD.
--   Cuando un resumen tiene consumos en una sola moneda los campos de la otra
--   moneda quedan en su valor por defecto (0 / NULL).

ALTER TABLE card_statements
  ADD COLUMN total_amount_usd        numeric       NOT NULL DEFAULT 0,
  ADD COLUMN paid_amount_usd         numeric       NULL,
  ADD COLUMN paid_from_account_id_usd uuid         NULL REFERENCES accounts(id);

CREATE INDEX IF NOT EXISTS idx_card_statements_paid_from_account_id_usd
  ON card_statements(paid_from_account_id_usd);
