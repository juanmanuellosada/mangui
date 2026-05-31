-- =============================================================
-- 0001_init_extensions_and_enums.sql
-- Habilitar extensiones necesarias y definir tipos enum globales.
-- Idempotente: usa IF NOT EXISTS / CREATE TYPE ... IF NOT EXISTS
-- =============================================================

-- uuid_generate_v4() no es necesario porque usamos gen_random_uuid()
-- (disponible en pgcrypto, incluido por defecto en Supabase).
-- Solo aseguramos pgcrypto por si acaso.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------
-- ENUMS
-- Definidos una única vez aquí para que todos los archivos siguientes
-- puedan referenciarlos sin dependencias circulares.
-- -----------------------------------------------------------------

-- Monedas soportadas
DO $$ BEGIN
  CREATE TYPE currency AS ENUM ('ARS', 'USD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipos de cotización del dólar (contexto argentino multimoneda)
DO $$ BEGIN
  CREATE TYPE rate_type AS ENUM ('oficial', 'blue', 'mep', 'ccl', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de cuenta bancaria/financiera
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM (
    'caja_ahorro',
    'cuenta_corriente',
    'efectivo',
    'inversion',
    'tarjeta_credito',
    'billetera_virtual',
    'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de movimiento (ingreso o egreso)
DO $$ BEGIN
  CREATE TYPE movement_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de categoría
DO $$ BEGIN
  CREATE TYPE category_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tema de la interfaz
DO $$ BEGIN
  CREATE TYPE ui_theme AS ENUM ('light', 'dark', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
