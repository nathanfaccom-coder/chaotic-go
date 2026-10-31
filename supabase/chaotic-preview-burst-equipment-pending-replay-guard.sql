-- v0.1.24: prevent the same still-unrevealed equipment from being
-- declared a second time on a later Burst turn, whether training effect
-- was applied or not. No original equipment is removed or rewritten.
create or replace function public.chaotic_queue_preview_burst_equipment(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_equipment_responses
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 c public.chaotic_preview_clashes;
 unit public.chaotic_preview_loadouts;
 result public.chaotic_preview_burst_equipment_responses;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Partida ou turno não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 não está ativa';end if;
 select * into w from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.status<>'awaiting_defender' or w.defender_id<>actor
  or w.attacker_id<>m.current_player then
  raise exception 'Apenas o defensor pode declarar equipamento durante Burst';end if;
 select * into c from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into unit from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 if c.attacker_id is distinct from w.attacker_id
  or c.defender_id is distinct from actor
  or c.defender_card is distinct from unit.card_instance_id
 then raise exception 'Defensor sem criatura válida no confronto';end if;
 if unit.equipment_instance_id is null or unit.equipment_name is null
  or pg_catalog.btrim(unit.equipment_instance_id)=''
 then raise exception 'Defensor não tem equipamento no DNA registrado';end if;
 if exists(select 1 from public.chaotic_preview_equipment_reveals e
  where e.lobby_id=p_lobby_id and e.actor_id=actor) then
  raise exception 'Equipamento já revelado';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_responses
  where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'Revelação já declarada nesta janela';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_responses old_q
  where old_q.lobby_id=p_lobby_id and old_q.defender_id=actor
    and old_q.equipment_instance_id=unit.equipment_instance_id) then
  raise exception 'Equipamento já declarado no Burst nesta partida';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_effects e
  where e.lobby_id=p_lobby_id and e.defender_id=actor
    and e.equipment_instance_id=unit.equipment_instance_id) then
  raise exception 'Este equipamento já ativou seu efeito de treino nesta partida';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Sequência de conferência já preparada';end if;
 insert into public.chaotic_preview_burst_equipment_responses(
  lobby_id,turn_no,defender_id,creature_instance_id,
  equipment_instance_id,equipment_name
 ) values(
  p_lobby_id,p_expected_turn,actor,unit.card_instance_id,
  unit.equipment_instance_id,unit.equipment_name
 ) returning * into result;
 return result;
end;
$fn$;

revoke all on function public.chaotic_queue_preview_burst_equipment(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_queue_preview_burst_equipment(uuid,integer)
 to authenticated;