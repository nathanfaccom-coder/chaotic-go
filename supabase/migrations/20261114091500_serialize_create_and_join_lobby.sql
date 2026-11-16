-- Serialize lobby creation and joining for the same authenticated player.
-- Both RPCs use advisory namespace 358 so create/join cannot race each other.
CREATE OR REPLACE FUNCTION public.chaotic_create_lobby(p_mode text)
RETURNS public.chaotic_lobbies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  old_room public.chaotic_lobbies;
  old_match public.chaotic_match_turns;
  result public.chaotic_lobbies;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login para abrir uma sala'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('1x1','3x3','6x6') THEN
    RAISE EXCEPTION 'Modo de batalha inválido';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 358));
  IF EXISTS (
    SELECT 1 FROM public.chaotic_lobbies
    WHERE guest_id = actor AND status = 'ready' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Saia da sala em que você é convidado antes de criar outra';
  END IF;
  IF (SELECT count(*) FROM public.chaotic_lobbies
      WHERE host_id=actor AND created_at>now()-interval '15 minutes') >= 10 THEN
    RAISE EXCEPTION 'Muitas salas criadas. Tente novamente mais tarde';
  END IF;
  FOR old_room IN
    SELECT * FROM public.chaotic_lobbies
    WHERE host_id=actor AND status IN ('waiting','ready') FOR UPDATE
  LOOP
    UPDATE public.chaotic_lobbies
      SET status='cancelled',updated_at=now() WHERE id=old_room.id;
    SELECT * INTO old_match FROM public.chaotic_match_turns
      WHERE lobby_id=old_room.id FOR UPDATE;
    IF FOUND AND old_match.status='active' THEN
      UPDATE public.chaotic_match_turns
        SET status='finished',updated_at=now() WHERE lobby_id=old_room.id;
      INSERT INTO public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
        VALUES(old_room.id,old_match.turn_no+1,actor,'stop',old_match.turn_no);
    END IF;
  END LOOP;
  INSERT INTO public.chaotic_lobbies(code,host_id,mode)
    VALUES(upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),actor,p_mode)
    RETURNING * INTO result;
  RETURN result;
END;
$function$;

-- Reassert join lock namespace explicitly alongside creation for auditability.
CREATE OR REPLACE FUNCTION public.chaotic_join_lobby(p_code text)
RETURNS public.chaotic_lobbies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  result public.chaotic_lobbies;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login para entrar na sala'; END IF;
  IF p_code IS NULL OR p_code !~* '^[a-f0-9]{12}$' THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;
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
  WHERE code = upper(p_code)
    AND status = 'waiting'
    AND guest_id IS NULL
    AND host_id <> actor
    AND expires_at > now()
  RETURNING * INTO result;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala indisponível, expirada ou já ocupada';
  END IF;
  RETURN result;
END;
$function$;
