-- =============================================================
-- 0012_auto_rules.sql
-- Reglas automáticas de auto-categorización
--
-- Tablas: auto_rules, auto_rule_conditions
-- Depende de: 0001 (enums, set_updated_at), 0003 (accounts, categories)
-- =============================================================
-- Idempotente: todos los CREATE usan IF NOT EXISTS.
-- Los enums usan DO $$ EXCEPTION WHEN duplicate_object para idempotencia.
-- Las políticas RLS se crean con el mismo patrón que 0003/0004/0010/0011.
-- =============================================================


-- -----------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------

-- Modo de coincidencia de condiciones: AND (todas) / OR (alguna)
DO $$ BEGIN
  CREATE TYPE rule_match AS ENUM ('all', 'any');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Campo del movimiento sobre el que evalúa la condición
DO $$ BEGIN
  CREATE TYPE rule_field AS ENUM ('note', 'amount', 'account', 'type');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Operador de comparación de la condición
DO $$ BEGIN
  CREATE TYPE rule_operator AS ENUM (
    'contains',
    'starts_with',
    'ends_with',
    'equals',
    'gt',
    'lt',
    'between'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =================================================================
-- TABLA: auto_rules
-- Define una regla de auto-categorización / auto-asignación de cuenta.
--
-- Una regla tiene:
--   - Un conjunto de condiciones (auto_rule_conditions).
--   - Un modo de coincidencia: 'all' (AND) / 'any' (OR) entre condiciones.
--   - Una o más acciones: asignar categoría y/o cuenta al movimiento.
--   - Prioridad (mayor = gana cuando múltiples reglas coinciden).
--   - Estado activo/inactivo.
--
-- CONSTRAINT: al menos una de action_category_id / action_account_id
-- debe ser NOT NULL — no tiene sentido una regla sin acción.
-- =================================================================
CREATE TABLE IF NOT EXISTS auto_rules (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dueño de la regla
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Nombre legible de la regla (ej: "Netflix → Suscripciones")
  name                text        NOT NULL,

  -- Prioridad: mayor número = mayor precedencia cuando varias reglas coinciden.
  -- Permite al usuario ordenar manualmente las reglas.
  priority            int         NOT NULL DEFAULT 0,

  -- Modo de evaluación de condiciones dentro de esta regla
  match               rule_match  NOT NULL DEFAULT 'all',

  -- ── Acciones de la regla ──────────────────────────────────────
  -- Al menos una debe ser NOT NULL (ver CHECK chk_rule_has_action).
  action_category_id  uuid        NULL REFERENCES categories(id) ON DELETE SET NULL,
  action_account_id   uuid        NULL REFERENCES accounts(id) ON DELETE SET NULL,

  -- Permite deshabilitar temporalmente la regla sin borrarla
  is_active           boolean     NOT NULL DEFAULT true,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Integridad: la regla debe tener al menos una acción definida
  CONSTRAINT chk_rule_has_action CHECK (
    action_category_id IS NOT NULL OR action_account_id IS NOT NULL
  )
);

-- Índice para listar/filtrar reglas del usuario
CREATE INDEX IF NOT EXISTS idx_auto_rules_user_id
  ON auto_rules(user_id);

-- Índice compuesto para la consulta de aplicación de reglas:
-- "reglas activas del usuario, ordenadas por prioridad descendente"
CREATE INDEX IF NOT EXISTS idx_auto_rules_user_active_priority
  ON auto_rules(user_id, is_active, priority DESC);

-- RLS
ALTER TABLE auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_rules_select_own"
  ON auto_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "auto_rules_insert_own"
  ON auto_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_rules_update_own"
  ON auto_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_rules_delete_own"
  ON auto_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_auto_rules_updated_at ON auto_rules;
CREATE TRIGGER trg_auto_rules_updated_at
  BEFORE UPDATE ON auto_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- TABLA: auto_rule_conditions
-- Cada fila es una condición individual dentro de una regla.
-- La regla evalúa todas sus condiciones con el operador 'all'/'any'
-- definido en auto_rules.match.
--
-- CAMPOS DE VALOR:
--   value_text  — usado cuando field IN ('note', 'type', 'account'):
--                   · note   + contains/starts_with/ends_with/equals → texto libre
--                   · type   + equals → 'income' | 'expense'
--                   · account + equals → uuid de la cuenta (como texto)
--   value_num   — usado cuando field = 'amount':
--                   · gt / lt / equals → valor único de comparación
--                   · between → cota inferior del rango
--   value_num2  — solo cuando field = 'amount' AND operator = 'between':
--                   · cota superior del rango
--
-- La validación de coherencia campo–operador–valor se hace en la
-- capa de aplicación (múltiples combinaciones, innecesario en DB).
--
-- position — orden de la condición en la lista de UI (para render
-- y para dar predictibilidad en evaluaciones futuras).
-- =================================================================
CREATE TABLE IF NOT EXISTS auto_rule_conditions (
  id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dueño directo (redundante con auto_rules.user_id, pero necesario
  -- para que las políticas RLS propias funcionen sin JOIN)
  user_id     uuid            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Regla a la que pertenece esta condición
  rule_id     uuid            NOT NULL REFERENCES auto_rules(id) ON DELETE CASCADE,

  -- Campo del movimiento a evaluar
  field       rule_field      NOT NULL,

  -- Operador de comparación
  operator    rule_operator   NOT NULL,

  -- Valor para campos de texto (note, type, account)
  value_text  text            NULL,

  -- Valor numérico único (amount gt/lt/equals) o cota inferior (between)
  value_num   numeric(18,2)   NULL,

  -- Cota superior, solo para operator = 'between'
  value_num2  numeric(18,2)   NULL,

  -- Orden de presentación en la UI (0-based)
  position    int             NOT NULL DEFAULT 0,

  created_at  timestamptz     NOT NULL DEFAULT now(),
  updated_at  timestamptz     NOT NULL DEFAULT now()
);

-- Índice para recuperar todas las condiciones de una regla (consulta frecuente)
CREATE INDEX IF NOT EXISTS idx_auto_rule_conditions_rule_id
  ON auto_rule_conditions(rule_id);

-- Índice para RLS / consultas por usuario
CREATE INDEX IF NOT EXISTS idx_auto_rule_conditions_user_id
  ON auto_rule_conditions(user_id);

-- RLS
ALTER TABLE auto_rule_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_rule_conditions_select_own"
  ON auto_rule_conditions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "auto_rule_conditions_insert_own"
  ON auto_rule_conditions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_rule_conditions_update_own"
  ON auto_rule_conditions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_rule_conditions_delete_own"
  ON auto_rule_conditions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_auto_rule_conditions_updated_at ON auto_rule_conditions;
CREATE TRIGGER trg_auto_rule_conditions_updated_at
  BEFORE UPDATE ON auto_rule_conditions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
