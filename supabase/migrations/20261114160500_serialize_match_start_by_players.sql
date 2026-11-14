-- Serialize match starts with player-level lobby operations, without changing rewards or game state schemas.
CREATE OR REPLACE FUNCTION public.chaotic_start_match(p_lobby_id uuid)
RETURNS public.chaotic_match_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  lobby public.chaotic_lobbies;
  match public.chaotic_match_turns;
  first_player uuid;
  second_player uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO lobby FROM public.chaotic_lobbies WHERE id=p_lobby_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada'; END IF;
  IF lobby.host_id <> actor THEN RAISE EXCEPTION 'Somente o anfitrião inicia a partida'; END IF;
  IF lobby.guest_id IS NULL OR lobby.host_id=lobby.guest_id THEN
    RAISE EXCEPTION 'Uma partida exige dois jogadores diferentes';
  END IF;
  first_player := least(lobby.host_id,lobby.guest_id);
  second_player := greatest(lobby.host_id,lobby.guest_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(first_player::text,358));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(second_player::text,358));
  SELECT * INTO lobby FROM public.chaotic_lobbies WHERE id=p_lobby_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada'; END IF;
  IF lobby.host_id <> actor OR lobby.guest_id IS DISTINCT FROM (CASE WHEN actor=first_player THEN second_player ELSE first_player END) THEN
    RAISE EXCEPTION 'Participantes da sala foram alterados';
  END IF;
  IF lobby.status <> 'ready' OR lobby.expires_at <= now() THEN
    RAISE EXCEPTION 'A sala precisa ter dois jogadores e estar ativa';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chaotic_match_turns m
    WHERE m.status='active' AND m.lobby_id<>p_lobby_id
      AND (m.host_id IN (lobby.host_id,lobby.guest_id)
        OR m.guest_id IN (lobby.host_id,lobby.guest_id))) THEN
    RAISE EXCEPTION 'Um dos jogadores já está em outra partida ativa';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chaotic_match_turns WHERE lobby_id=p_lobby_id) THEN
    RAISE EXCEPTION 'Já existe uma partida para esta sala';
  END IF;
  INSERT INTO public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player)
    VALUES(p_lobby_id,lobby.host_id,lobby.guest_id,lobby.host_id) RETURNING * INTO match;
  INSERT INTO public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
    VALUES(p_lobby_id,1,actor,'start',1);
  RETURN match;
END;
$function$;