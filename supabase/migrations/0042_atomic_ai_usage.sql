-- Fix TOCTOU race en el rate-limit de IA: reemplaza el patrón count→insert
-- (dos pasos, insert sin await) por una función atómica.
-- Depende de: 0031 (tabla ai_usage)
--
-- CAMBIOS:
--   1. Crea check_and_increment_ai_usage(p_user_id, p_limit, p_model) —
--      cuenta el uso de HOY (America/Argentina/Buenos_Aires, mismo criterio
--      que todayAR() en src/lib/date-utils.ts: fecha AR interpretada como
--      medianoche UTC) e inserta una fila de forma atómica para p_user_id,
--      usando un advisory lock por usuario para serializar llamadas
--      concurrentes dentro de la misma transacción. Devuelve true si la
--      llamada quedó dentro del límite (y quedó registrada), false si se
--      alcanzó el límite (no inserta). p_limit = NULL significa "sin
--      límite" (premium / ai_unlimited): siempre registra y devuelve true.
--      p_user_id se recibe como parámetro (en vez de usar auth.uid()) porque
--      esta función se invoca desde el cliente admin (service_role), que no
--      tiene contexto JWT. Por eso mismo NO se otorga a `authenticated`:
--      solo el código server-side (vía service_role) puede llamarla, así el
--      p_limit que provee el server es confiable y no puede ser manipulado
--      desde el browser.

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_user_id uuid,
  p_limit integer,
  p_model text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today_start timestamptz;
  v_count integer;
BEGIN
  -- Serializa llamadas concurrentes del mismo usuario dentro de esta
  -- transacción (se libera automáticamente al terminar). Sin esto, dos
  -- requests simultáneos podrían contar el mismo total antes de que
  -- cualquiera de los dos inserte su fila (la condición de carrera que
  -- esta función viene a resolver).
  PERFORM pg_catalog.pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- "Hoy" en America/Argentina/Buenos_Aires, mismo cálculo que todayAR()
  -- del lado del cliente (fecha AR, interpretada luego como medianoche UTC).
  v_today_start := (
    to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')
    || 'T00:00:00.000Z'
  )::timestamptz;

  SELECT count(*) INTO v_count
  FROM public.ai_usage
  WHERE user_id = p_user_id
    AND created_at >= v_today_start;

  IF p_limit IS NOT NULL AND v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage (user_id, model) VALUES (p_user_id, p_model);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, integer, text) TO service_role;
