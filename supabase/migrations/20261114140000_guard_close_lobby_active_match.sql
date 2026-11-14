-- A lobby invitation must never terminate an ongoing authoritative match.
CREATE OR REPLACE FUNCTION public.chaotic_close_lobby(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  affected integer;
  match_status text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  PERFORM 1 FROM public.chaotic_lobbies WHERE id=p_id AND host_id=actor FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Lock the match row before checking its state to avoid concurrent transitions.
  SELECT status INTO match_status FROM public.chaotic_match_turns
    WHERE lobby_id=p_id FOR UPDATE;
  IF match_status = 'active' THEN
    RAISE EXCEPTION 'Partida em andamento: encerre o combate pelo fluxo oficial';
  END IF;
  UPDATE public.chaotic_lobbies
    SET status='cancelled',updated_at=now()
    WHERE id=p_id AND status IN ('waiting','ready');
  GET DIAGNOSTICS affected = row_count;
  RETURN affected > 0;
END;
$function$;
