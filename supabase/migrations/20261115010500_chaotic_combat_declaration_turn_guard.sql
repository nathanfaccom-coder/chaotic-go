-- Fail closed for newly inserted combat declarations without changing legacy rows.
CREATE OR REPLACE FUNCTION public.chaotic_guard_combat_declaration_turn()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE v_match public.chaotic_match_turns%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.chaotic_match_turns
    WHERE lobby_id = NEW.lobby_id FOR UPDATE;
  IF NOT FOUND OR v_match.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Declaração exige partida ativa' USING ERRCODE='23514';
  END IF;
  IF NEW.turn_no IS DISTINCT FROM v_match.turn_no THEN
    RAISE EXCEPTION 'Declaração fora do turno atual' USING ERRCODE='23514';
  END IF;
  IF NEW.actor_id IS DISTINCT FROM v_match.current_player THEN
    RAISE EXCEPTION 'Declaração exige o jogador da vez' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chaotic_combat_declaration_turn_guard ON public.chaotic_combat_declarations;
CREATE TRIGGER chaotic_combat_declaration_turn_guard
BEFORE INSERT ON public.chaotic_combat_declarations
FOR EACH ROW EXECUTE FUNCTION public.chaotic_guard_combat_declaration_turn();