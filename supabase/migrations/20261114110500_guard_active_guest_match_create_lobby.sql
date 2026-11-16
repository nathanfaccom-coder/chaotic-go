-- Keep active guest matches protected even when the invitation has expired.
CREATE OR REPLACE FUNCTION public.chaotic_create_lobby(p_mode text)
 RETURNS chaotic_lobbies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  old_room public.chaotic_lobbies;
  result public.chaotic_lobbies;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login para abrir uma sala'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('1x1','3x3','6x6') THEN
    RAISE EXCEPTION 'Modo de batalha inválido';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,358));
  IF EXISTS (
    SELECT 1 FROM public.chaotic_lobbies
    WHERE guest_id=actor AND status='ready' AND (expires_at>now() OR EXISTS (SELECT 1 FROM public.chaotic_match_turns m WHERE m.lobby_id=chaotic_lobbies.id AND m.status='active'))
  ) THEN
    RAISE EXCEPTION 'Saia da sala em que você é convidado antes de criar outra';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.chaotic_lobbies l
    JOIN public.chaotic_match_turns m ON m.lobby_id=l.id
    WHERE l.host_id=actor AND l.status IN ('waiting','ready') AND m.status='active'
  ) THEN
    RAISE EXCEPTION 'Encerre a partida ativa antes de criar outra sala';
  END IF;
  IF (SELECT count(*) FROM public.chaotic_lobbies
      WHERE host_id=actor AND created_at>now()-interval '15 minutes')>=10 THEN
    RAISE EXCEPTION 'Muitas salas criadas. Tente novamente mais tarde';
  END IF;
  FOR old_room IN
    SELECT * FROM public.chaotic_lobbies
    WHERE host_id=actor AND status IN ('waiting','ready') FOR UPDATE
  LOOP
    -- Recheck while holding row lock, protecting against a match starting
    -- between the initial check and cancellation.
    IF EXISTS (SELECT 1 FROM public.chaotic_match_turns
               WHERE lobby_id=old_room.id AND status='active' FOR UPDATE) THEN
      RAISE EXCEPTION 'Encerre a partida ativa antes de criar outra sala';
    END IF;
    UPDATE public.chaotic_lobbies
      SET status='cancelled',updated_at=now() WHERE id=old_room.id;
  END LOOP;
  INSERT INTO public.chaotic_lobbies(code,host_id,mode)
    VALUES(upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),actor,p_mode)
    RETURNING * INTO result;
  RETURN result;
END;
$function$
;
