-- =============================================================
-- 0015_push_notifications.sql
-- Fase 7 — PWA Offline + Web Push Notifications
--
-- Tablas nuevas:
--   push_subscriptions  — un registro por browser/dispositivo autorizado
--   notification_log    — dedup de eventos ya notificados
--
-- Alteraciones:
--   user_preferences    — columnas de configuración de notificaciones
--
-- DISEÑO:
--   push_subscriptions: el cliente (JS service worker) inserta su propia
--     suscripción VAPID al conceder permiso. RLS completo: el usuario puede
--     SELECT, INSERT, UPDATE y DELETE sus propias filas.
--
--   notification_log: escrito exclusivamente por el service role (cron/edge
--     function). RLS habilitado con solo política SELECT para el usuario.
--     El service role bypassa RLS en Supabase → no necesita políticas de
--     escritura. Patrón idéntico al de exchange_rates.
--
--   user_preferences: ADD COLUMN IF NOT EXISTS (idempotente). No rompe
--     instancias existentes; los usuarios existentes obtienen los defaults.
--
-- Depende de: auth.users (Supabase Auth), 0002 (user_preferences, set_updated_at)
-- Idempotente: CREATE TABLE IF NOT EXISTS + DO $$ ... EXCEPTION + ADD COLUMN IF NOT EXISTS
-- =============================================================


-- =================================================================
-- TABLA: push_subscriptions
-- Un registro por browser / dispositivo que el usuario autorizó para
-- recibir Web Push Notifications. Las claves VAPID (p256dh, auth)
-- son específicas del endpoint y se usan al enviar la notificación
-- desde el backend.
--
-- La suscripción se crea desde el cliente (service worker) una vez
-- que el usuario concede permiso en el navegador. El cliente hace
-- un INSERT con sus propias claves.
--
-- El campo user_agent es opcional; permite mostrar al usuario qué
-- dispositivos tienen notificaciones activas (ej: "Chrome · Mac").
-- =================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK al usuario propietario de la suscripción.
  -- ON DELETE CASCADE: si se borra el usuario, se eliminan todas sus
  -- suscripciones automáticamente (sin notificaciones huérfanas).
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- URL de destino del push endpoint (proporcionada por el browser).
  -- Único por usuario + endpoint para evitar duplicados si el SW
  -- se re-registra. El endpoint puede cambiar al rotar las claves.
  endpoint     text        NOT NULL,

  -- Clave pública del cliente para cifrado ECDH (Base64url, P-256).
  p256dh       text        NOT NULL,

  -- Clave de autenticación del cliente (Base64url, 16 bytes).
  auth         text        NOT NULL,

  -- User-Agent del navegador para identificar el dispositivo en la UI.
  -- NULL si el cliente no lo envía.
  user_agent   text        NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Un usuario no puede tener dos suscripciones con el mismo endpoint.
  UNIQUE (user_id, endpoint)
);

-- -----------------------------------------------------------------
-- ÍNDICE: user_id
-- Cubre la consulta más frecuente: listar suscripciones del usuario
-- (para mostrar dispositivos activos y para el fanout al enviar push).
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id);

-- =================================================================
-- RLS para push_subscriptions
-- Política completa (select / insert / update / delete) por usuario.
-- El cliente inserta sus propias suscripciones; el backend
-- (service role) lee todas para el fanout — el service role
-- bypassa RLS por defecto, así que no necesita política propia.
-- =================================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: solo las suscripciones propias
DO $$ BEGIN
  CREATE POLICY "push_subscriptions: select own"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: el cliente solo puede insertar filas con su propio user_id
DO $$ BEGIN
  CREATE POLICY "push_subscriptions: insert own"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE: el cliente puede actualizar sus propias suscripciones
-- (por ejemplo, refrescar las claves al rotar el endpoint)
DO $$ BEGIN
  CREATE POLICY "push_subscriptions: update own"
    ON push_subscriptions FOR UPDATE
    USING     (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: el cliente puede revocar sus propias suscripciones
-- (al desactivar notificaciones en la pantalla de configuración)
DO $$ BEGIN
  CREATE POLICY "push_subscriptions: delete own"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =================================================================
-- TABLA: notification_log
-- Registro de deduplicación de notificaciones enviadas.
-- Garantiza que un evento no genere más de una notificación
-- por usuario y canal.
--
-- event_key es una cadena que identifica unívocamente el evento,
-- por ejemplo:
--   'card_due:<accountId>:<YYYY-MM>'       — vencimiento de resumen
--   'occurrence:<occurrenceId>'            — ocurrencia de recurrente
--   'scheduled:<scheduledTransactionId>'   — transacción programada
--
-- ESCRITURA: exclusiva del service role (cron / edge function).
--   RLS habilitado + sin políticas INSERT/UPDATE/DELETE →
--   solo el service role (que bypassa RLS) puede escribir.
--   Patrón idéntico al de exchange_rates.
--
-- LECTURA: el usuario autenticado puede leer su propio historial
--   (útil para debugging y para la UI de "notificaciones enviadas").
-- =================================================================
CREATE TABLE IF NOT EXISTS notification_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK al usuario destinatario.
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Clave de evento para deduplicación.
  -- Formato sugerido: '<tipo>:<identificador>:<período-si-aplica>'
  event_key  text        NOT NULL,

  -- Canal por el que se envió la notificación.
  -- 'push' es el valor inicial; reservado para futuros canales (email, sms).
  channel    text        NOT NULL DEFAULT 'push',

  -- Momento exacto del envío. Usado para TTL / limpieza periódica.
  sent_at    timestamptz NOT NULL DEFAULT now(),

  -- Un usuario no puede tener dos registros del mismo evento en el mismo canal.
  UNIQUE (user_id, event_key)
);

-- -----------------------------------------------------------------
-- ÍNDICE: user_id
-- Cubre la consulta de verificación de duplicados por usuario antes
-- de enviar cada notificación (el cron hace: WHERE user_id = $1 AND event_key = $2).
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_log_user_id
  ON notification_log (user_id);

-- =================================================================
-- RLS para notification_log
-- Solo SELECT propio para el usuario autenticado.
-- Sin políticas INSERT/UPDATE/DELETE → solo service_role escribe.
-- (El service role bypassa RLS por defecto en Supabase.)
-- Patrón idéntico al de exchange_rates.
-- =================================================================
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- SELECT: el usuario puede consultar su propio historial de notificaciones
DO $$ BEGIN
  CREATE POLICY "notification_log: select own"
    ON notification_log FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sin políticas INSERT/UPDATE/DELETE → solo service_role puede escribir
-- (el service_role bypassa RLS por defecto en Supabase)


-- =================================================================
-- ALTER: user_preferences
-- Agrega columnas de configuración de notificaciones push.
-- ADD COLUMN IF NOT EXISTS es idempotente: no falla si la columna ya existe.
-- Los usuarios existentes obtienen los valores por defecto inmediatamente.
-- =================================================================

-- push_enabled: indica si el usuario habilitó las notificaciones push en la app.
-- false por defecto: el usuario debe activarlo explícitamente en Configuración.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;

-- notify_hour: hora del día (0–23, hora AR / America/Argentina/Buenos_Aires)
-- en que se envían los avisos programados (recordatorios, vencimientos).
-- Default 9 = 9:00 hs, fuera de horario de silencio nocturno.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notify_hour int NOT NULL DEFAULT 9
    CHECK (notify_hour >= 0 AND notify_hour <= 23);

-- card_reminder_enabled: activa o desactiva el recordatorio de fechas
-- de cierre y vencimiento de resúmenes de tarjeta de crédito.
-- true por defecto porque es la notificación más demandada en el contexto AR.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS card_reminder_enabled boolean NOT NULL DEFAULT true;
