-- Keep one active lobby per joining player, including when they are the host.
CREATE OR REPLACE FUNCTION public.chaotic_join_lobby(p_code text)
RETURNS public.chaotic_lobbies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  result public.chaotic_lobbies;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login para entrar na sala'; END IF;
  IF p_code IS NULL OR p_code !~* '^[a-f0-9]{12}$' THEN RAISE EXCEPTION 'Código inválido'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 358));
  IF EXISTS (
    SELECT 1 FROM public.chaotic_lobbies
    WHERE expires_at > now()
      AND ((guest_id = actor AND status = 'ready')
        OR (host_id = actor AND status IN ('waiting', 'ready')))
  ) THEN
    RAISE EXCEPTION 'Você já participa de uma sala ativa. Encerre-a antes de entrar em outra';
  END IF;
  UPDATE public.chaotic_lobbies
  SET guest_id = actor, status = 'ready', updated_at = now()
  WHERE code = upper(p_code) AND status = 'waiting'
    AND guest_id IS NULL AND host_id <> actor AND expires_at > now()
  RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala indisponível, expirada ou já ocupada'; END IF;
  RETURN result;
END;
$function$;