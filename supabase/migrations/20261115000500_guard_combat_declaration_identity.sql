CREATE OR REPLACE FUNCTION public.chaotic_guard_combat_declaration_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
 IF NEW.lobby_id IS DISTINCT FROM OLD.lobby_id
 OR NEW.turn_no IS DISTINCT FROM OLD.turn_no
 OR NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
  RAISE EXCEPTION 'Identidade da declaração de combate é imutável' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chaotic_guard_combat_declaration_identity_update ON public.chaotic_combat_declarations;
CREATE TRIGGER chaotic_guard_combat_declaration_identity_update
BEFORE UPDATE ON public.chaotic_combat_declarations
FOR EACH ROW EXECUTE FUNCTION public.chaotic_guard_combat_declaration_identity();