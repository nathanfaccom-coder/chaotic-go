-- Keep the identity of an authoritative match stable throughout its lifecycle.
-- Does not modify any existing match, card, deck or economy data.
CREATE OR REPLACE FUNCTION public.chaotic_guard_match_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.lobby_id IS DISTINCT FROM OLD.lobby_id
     OR NEW.host_id IS DISTINCT FROM OLD.host_id
     OR NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
    RAISE EXCEPTION 'Match participants and lobby are immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chaotic_match_identity_immutable ON public.chaotic_match_turns;
CREATE TRIGGER chaotic_match_identity_immutable
BEFORE UPDATE ON public.chaotic_match_turns
FOR EACH ROW EXECUTE FUNCTION public.chaotic_guard_match_identity();
