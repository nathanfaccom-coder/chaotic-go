-- Reject forged event attribution without changing existing match mechanics.
CREATE OR REPLACE FUNCTION public.chaotic_guard_match_event_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_host uuid;
  v_guest uuid;
BEGIN
  IF NEW.actor_id IS NULL THEN
    RETURN NEW; -- preserve system-generated events
  END IF;
  SELECT m.host_id, m.guest_id INTO v_host, v_guest
  FROM public.chaotic_match_turns AS m
  WHERE m.lobby_id = NEW.lobby_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento sem partida correspondente' USING ERRCODE = '23514';
  END IF;
  IF NEW.actor_id IS DISTINCT FROM v_host
     AND NEW.actor_id IS DISTINCT FROM v_guest THEN
    RAISE EXCEPTION 'Autor do evento não participa da partida' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chaotic_match_event_actor_guard ON public.chaotic_match_events;
CREATE TRIGGER chaotic_match_event_actor_guard
BEFORE INSERT OR UPDATE OF actor_id, lobby_id
ON public.chaotic_match_events
FOR EACH ROW EXECUTE FUNCTION public.chaotic_guard_match_event_actor();