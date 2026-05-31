-- =============================================================
-- 0011_recurring_scheduled.sql
-- Tablas: recurring_transactions, recurring_occurrences,
--         scheduled_transactions
-- Depende de: 0001 (currency enum), 0003 (accounts, categories),
--             0004 (movements, transfers), 0002 (set_updated_at fn)
--
-- Idempotente: todos los CREATE TYPE, CREATE TABLE, CREATE INDEX,
-- ALTER TABLE y CREATE POLICY usan guardas (IF NOT EXISTS / DO $$
-- EXCEPTION duplicate_object/duplicate_table/duplicate_object).
-- Las políticas RLS usan el mismo patrón DO $$ que 0010.
-- =============================================================


-- =================================================================
-- SECCIÓN 1: NUEVOS ENUMS
-- Siguen el mismo patrón que 0001_init_extensions_and_enums.sql:
-- DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- =================================================================

-- Tipo de transacción (unifica income/expense/transfer para las
-- tablas de recurrentes y programadas, donde el sentido lo da `kind`
-- y no `movement_type` para evitar confusión con el enum existente).
DO $$ BEGIN
  CREATE TYPE txn_kind AS ENUM ('income', 'expense', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Frecuencia de recurrencia
DO $$ BEGIN
  CREATE TYPE recurring_frequency AS ENUM (
    'weekly',      -- semanal
    'biweekly',    -- quincenal
    'monthly',     -- mensual
    'bimonthly',   -- bimestral
    'annual'       -- anual
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Qué hacer cuando la fecha calculada cae un fin de semana
DO $$ BEGIN
  CREATE TYPE weekend_handling AS ENUM (
    'as_is',               -- ejecutar tal cual (sábado o domingo)
    'skip',                -- no generar ocurrencia ese ciclo
    'previous_business_day' -- adelantar al viernes hábil anterior
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado del template de recurrencia
DO $$ BEGIN
  CREATE TYPE recurring_status AS ENUM (
    'active',   -- generando ocurrencias normalmente
    'paused',   -- suspendida temporariamente por el usuario
    'inactive'  -- finalizada o cancelada definitivamente
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado de una ocurrencia generada a partir de un template
DO $$ BEGIN
  CREATE TYPE occurrence_status AS ENUM (
    'pending',   -- generada, esperando confirmación del usuario
    'confirmed', -- confirmada y materializada como movement/transfer
    'skipped'    -- usuario eligió saltear este ciclo
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado de una transacción programada puntual (one-shot)
DO $$ BEGIN
  CREATE TYPE scheduled_status AS ENUM (
    'pending',   -- aún no llegó la fecha o no fue procesada
    'executed',  -- materializada como movement/transfer
    'rejected'   -- descartada/rechazada por el usuario
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =================================================================
-- SECCIÓN 2: recurring_transactions
-- Template que define una regla de repetición. La app/cron lee esta
-- tabla para proyectar las próximas ocurrencias (recurring_occurrences).
--
-- REGLAS DE NEGOCIO:
--   - kind = 'income' | 'expense': account_id es la cuenta afectada.
--     to_account_id y to_amount deben ser NULL.
--   - kind = 'transfer': account_id = cuenta origen, to_account_id =
--     cuenta destino (NOT NULL, distinta de account_id). to_amount es
--     el monto en la moneda destino (NULL si igual moneda que origin).
--   - day_of_week aplica solo a weekly/biweekly (0=domingo..6=sábado).
--   - day_of_month aplica a monthly/bimonthly/annual.
--   - month_of_year aplica solo a annual (1=enero..12=diciembre).
--   - next_run es computado por la app/cron y almacenado aquí para
--     consultas eficientes; NO es la fuente de verdad de la regla.
--   - is_card_recurring: cuando true, las ocurrencias confirmadas
--     se agrupan en los resúmenes de tarjeta de crédito (card_statements).
-- =================================================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id                 uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid               NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo: ingreso, gasto o transferencia
  kind               txn_kind           NOT NULL,

  -- Monto base. Para transferencias multimoneda, es el monto origen.
  amount             numeric(18,2)      NOT NULL CHECK (amount > 0),
  currency           currency           NOT NULL,

  -- Cuenta afectada (origen para transferencias)
  account_id         uuid               NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Solo para kind = 'transfer'
  to_account_id      uuid               NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Monto en la moneda de la cuenta destino (NULL si misma moneda que origen)
  to_amount          numeric(18,2)      NULL CHECK (to_amount > 0),

  -- Categoría (no aplica a transferencias, pero se permite nullable en ambos)
  category_id        uuid               NULL REFERENCES categories(id) ON DELETE SET NULL,

  -- Descripción libre
  note               text,

  -- ── Regla de recurrencia ─────────────────────────────────────
  frequency          recurring_frequency NOT NULL,

  -- Día de la semana para weekly/biweekly (0=domingo, 6=sábado)
  day_of_week        int                NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Día del mes para monthly/bimonthly/annual (1–31; si el mes
  -- tiene menos días, la app usa el último día del mes)
  day_of_month       int                NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),

  -- Mes del año para annual (1–12)
  month_of_year      int                NULL CHECK (month_of_year >= 1 AND month_of_year <= 12),

  -- Política de manejo de fin de semana
  weekend_handling   weekend_handling   NOT NULL DEFAULT 'as_is',

  -- Vigencia del template
  start_date         date               NOT NULL,
  end_date           date               NULL,  -- NULL = sin fecha de fin

  -- Fecha calculada de la próxima ejecución (mantenida por app/cron)
  next_run           date               NULL,

  -- Estado del template
  status             recurring_status   NOT NULL DEFAULT 'active',

  -- Cuando true, las ocurrencias confirmadas se asocian a resúmenes
  -- de tarjeta (card_statements) en lugar de movimientos sueltos.
  is_card_recurring  boolean            NOT NULL DEFAULT false,

  created_at         timestamptz        NOT NULL DEFAULT now(),
  updated_at         timestamptz        NOT NULL DEFAULT now(),

  -- ── Integridad de transferencias ─────────────────────────────
  -- Para kind='transfer': to_account_id debe existir y diferir de account_id.
  -- Para income/expense: to_account_id y to_amount deben ser NULL.
  -- Implementado como CHECK soft (sin subquery) para no bloquear DDL.
  CONSTRAINT chk_recurring_transfer_fields CHECK (
    (kind = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id)
    OR
    (kind <> 'transfer' AND to_account_id IS NULL AND to_amount IS NULL)
  )
);

-- Índice de usuario (lookup general)
CREATE INDEX IF NOT EXISTS idx_recurring_user
  ON recurring_transactions(user_id);

-- Índice compuesto para el cron/scheduler: busca templates activos con next_run próxima
CREATE INDEX IF NOT EXISTS idx_recurring_user_status_next_run
  ON recurring_transactions(user_id, status, next_run);

-- RLS
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "recurring_transactions_select_own"
    ON recurring_transactions FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "recurring_transactions_insert_own"
    ON recurring_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "recurring_transactions_update_own"
    ON recurring_transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "recurring_transactions_delete_own"
    ON recurring_transactions FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_recurring_transactions_updated_at ON recurring_transactions;
CREATE TRIGGER trg_recurring_transactions_updated_at
  BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- SECCIÓN 3: recurring_occurrences
-- Instancias generadas a partir de un template (recurring_transactions).
-- Una ocurrencia por fecha-ciclo proyectada. El usuario la confirma,
-- edita o saltea desde la bandeja de "Próximas ocurrencias".
--
-- REGLAS DE NEGOCIO:
--   - UNIQUE (recurring_id, scheduled_date): no puede existir dos
--     ocurrencias del mismo template para la misma fecha.
--   - amount_override: permite editar el monto solo para esta instancia
--     sin modificar el template. NULL = usar amount del template.
--   - movement_id / transfer_id: se populan al confirmar la ocurrencia
--     (se crea el movement/transfer correspondiente). Ambos NULL
--     mientras está en estado 'pending' o 'skipped'.
-- =================================================================
CREATE TABLE IF NOT EXISTS recurring_occurrences (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid               NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template que generó esta ocurrencia
  recurring_id     uuid               NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,

  -- Fecha proyectada de esta ocurrencia (según la regla del template)
  scheduled_date   date               NOT NULL,

  -- Estado de la ocurrencia
  status           occurrence_status  NOT NULL DEFAULT 'pending',

  -- Monto editado solo para este ciclo (NULL = heredar del template)
  amount_override  numeric(18,2)      NULL CHECK (amount_override > 0),

  -- Referencia al movimiento/transferencia creada al confirmar
  movement_id      uuid               NULL REFERENCES movements(id)  ON DELETE SET NULL,
  transfer_id      uuid               NULL REFERENCES transfers(id)  ON DELETE SET NULL,

  created_at       timestamptz        NOT NULL DEFAULT now(),
  updated_at       timestamptz        NOT NULL DEFAULT now(),

  -- Una sola ocurrencia por template y fecha
  CONSTRAINT uq_recurring_occurrence_date UNIQUE (recurring_id, scheduled_date)
);

-- Índice para la bandeja del usuario (filtra por estado)
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_user_status
  ON recurring_occurrences(user_id, status);

-- Índice para listar todas las ocurrencias de un template
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_recurring_id
  ON recurring_occurrences(recurring_id);

-- RLS
ALTER TABLE recurring_occurrences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "recurring_occurrences_select_own"
    ON recurring_occurrences FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "recurring_occurrences_insert_own"
    ON recurring_occurrences FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "recurring_occurrences_update_own"
    ON recurring_occurrences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "recurring_occurrences_delete_own"
    ON recurring_occurrences FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_recurring_occurrences_updated_at ON recurring_occurrences;
CREATE TRIGGER trg_recurring_occurrences_updated_at
  BEFORE UPDATE ON recurring_occurrences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- SECCIÓN 4: scheduled_transactions
-- Transacciones programadas puntuales (one-shot, fecha futura fija).
-- No generan ocurrencias repetidas: cuando llega la fecha, la app
-- las ejecuta (crea el movement/transfer) y actualiza status a
-- 'executed', o el usuario las rechaza ('rejected').
--
-- REGLAS DE NEGOCIO:
--   - Misma lógica de kind que recurring_transactions: 'transfer'
--     requiere to_account_id; 'income'/'expense' lo prohíben.
--   - movement_id / transfer_id: NULL hasta que se ejecuta.
--   - La columna `date` es la fecha objetivo (puede ser pasada si
--     quedó pendiente; la app decide si ejecutar igual o rechazar).
-- =================================================================
CREATE TABLE IF NOT EXISTS scheduled_transactions (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid               NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo: ingreso, gasto o transferencia
  kind             txn_kind           NOT NULL,

  -- Monto. Para transferencias, es el monto en la moneda de account_id.
  amount           numeric(18,2)      NOT NULL CHECK (amount > 0),
  currency         currency           NOT NULL,

  -- Cuenta afectada (origen para transferencias)
  account_id       uuid               NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Solo para kind = 'transfer'
  to_account_id    uuid               NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Monto en moneda destino (NULL si misma moneda)
  to_amount        numeric(18,2)      NULL CHECK (to_amount > 0),

  -- Categoría
  category_id      uuid               NULL REFERENCES categories(id) ON DELETE SET NULL,

  -- Descripción libre
  note             text,

  -- Fecha objetivo de ejecución
  date             date               NOT NULL,

  -- Estado de la transacción programada
  status           scheduled_status   NOT NULL DEFAULT 'pending',

  -- Referencia al movimiento/transferencia creada al ejecutar
  movement_id      uuid               NULL REFERENCES movements(id)  ON DELETE SET NULL,
  transfer_id      uuid               NULL REFERENCES transfers(id)  ON DELETE SET NULL,

  created_at       timestamptz        NOT NULL DEFAULT now(),
  updated_at       timestamptz        NOT NULL DEFAULT now(),

  -- Integridad de transferencias (mismo patrón que recurring_transactions)
  CONSTRAINT chk_scheduled_transfer_fields CHECK (
    (kind = 'transfer' AND to_account_id IS NOT NULL AND to_account_id <> account_id)
    OR
    (kind <> 'transfer' AND to_account_id IS NULL AND to_amount IS NULL)
  )
);

-- Índice compuesto para la bandeja: filtra por usuario, estado y fecha
CREATE INDEX IF NOT EXISTS idx_scheduled_user_status_date
  ON scheduled_transactions(user_id, status, date);

-- RLS
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "scheduled_transactions_select_own"
    ON scheduled_transactions FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "scheduled_transactions_insert_own"
    ON scheduled_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "scheduled_transactions_update_own"
    ON scheduled_transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "scheduled_transactions_delete_own"
    ON scheduled_transactions FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_scheduled_transactions_updated_at ON scheduled_transactions;
CREATE TRIGGER trg_scheduled_transactions_updated_at
  BEFORE UPDATE ON scheduled_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- SECCIÓN 5: FK forward-compat — recurring_id en movements/transfers
-- Las columnas recurring_id ya existen (nullable, sin FK) desde 0004.
-- Ahora que recurring_transactions existe, formalizamos la integridad
-- referencial con un bloque DO idempotente (igual que 0010 con
-- installment_purchase_id).
-- ON DELETE SET NULL: borrar el template no borra los movimientos
-- históricos ya generados, solo desvincula la referencia.
-- =================================================================
DO $$ BEGIN
  ALTER TABLE movements
    ADD CONSTRAINT movements_recurring_id_fkey
    FOREIGN KEY (recurring_id)
    REFERENCES recurring_transactions(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE transfers
    ADD CONSTRAINT transfers_recurring_id_fkey
    FOREIGN KEY (recurring_id)
    REFERENCES recurring_transactions(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
