-- Combat declarations must be attributed to a participant in the linked match.
CREATE OR REPLACE FUNCTION public.chaotic_guard_combat_declaration_actor()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE v_host uuid; v_guest uuid;
BEGIN
  SELECT m.host_id, m.guest_id INTO v_host, v_guest
  FROM public.chaotic_match_turns AS m WHERE m.lobby_id = NEW.lobby_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Declaração sem partida correspondente' USING ERRCODE = '23514';
  END IF;
  IF NEW.actor_id IS NULL OR
     (NEW.actor_id IS DISTINCT FROM v_host AND NEW.actor_id IS DISTINCT FROM v_guest) THEN
    RAISE EXCEPTION 'Declaração de combate exige participante da partida' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chaotic_combat_declaration_actor_guard ON public.chaotic_combat_declarations;
CREATE TRIGGER chaotic_combat_declaration_actor_guard
BEFORE INSERT OR UPDATE OF actor_id, lobby_id ON public.chaotic_combat_declarations
FOR EACH ROW EXECUTE FUNCTION public.chaotic_guard_combat_declaration_actor();
