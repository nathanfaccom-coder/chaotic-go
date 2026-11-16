-- Reject duplicate active participation at the authoritative match-start boundary.
-- Existing rooms, match history, cards, balances and rewards remain untouched.
CREATE OR REPLACE FUNCTION public.chaotic_start_match(p_lobby_id uuid)
RETURNS public.chaotic_match_turns
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  lobby public.chaotic_lobbies;
  match public.chaotic_match_turns;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO lobby FROM public.chaotic_lobbies WHERE id=p_lobby_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala não encontrada'; END IF;
  IF lobby.host_id <> actor THEN RAISE EXCEPTION 'Somente o anfitrião inicia a partida'; END IF;
  IF lobby.status <> 'ready' OR lobby.guest_id IS NULL OR lobby.expires_at <= now() THEN
    RAISE EXCEPTION 'A sala precisa ter dois jogadores e estar ativa';
  END IF;
  IF lobby.host_id = lobby.guest_id THEN
    RAISE EXCEPTION 'Uma partida exige dois jogadores diferentes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.chaotic_match_turns m
    WHERE m.status='active' AND m.lobby_id <> p_lobby_id
      AND (m.host_id IN (lobby.host_id,lobby.guest_id)
        OR m.guest_id IN (lobby.host_id,lobby.guest_id))
  ) THEN
    RAISE EXCEPTION 'Um dos jogadores já está em outra partida ativa';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chaotic_match_turns WHERE lobby_id=p_lobby_id) THEN
    RAISE EXCEPTION 'Já existe uma partida para esta sala';
  END IF;
  INSERT INTO public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player)
    VALUES(p_lobby_id,lobby.host_id,lobby.guest_id,lobby.host_id)
    RETURNING * INTO match;
  INSERT INTO public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
    VALUES(p_lobby_id,1,actor,'start',1);
  RETURN match;
END;
$function$;