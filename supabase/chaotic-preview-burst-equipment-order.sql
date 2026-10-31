-- v0.1.23: inspect a defender's pending equipment reveal before the attack,
-- preserving the reverse-of-declaration order. No effect executes yet.
create or replace function public.chaotic_prepare_preview_burst_order(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_order_plans
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 win public.chaotic_preview_burst_windows;
 clash public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 queued public.chaotic_preview_burst_equipment_responses;
 steps jsonb;
 result public.chaotic_preview_burst_order_plans;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null
  or p_expected_turn not between 1 and 120 then
  raise exception 'Número de turno inválido';end if;

 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player<>actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Só o atacante pode preparar a sequência em sua vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 inválida';end if;
 select * into win from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or win.attacker_id<>actor
  or win.defender_id not in(m.host_id,m.guest_id) or win.defender_id=actor
  or win.status not in('defender_passed','defender_immunity_noted')
  or win.defender_responded_at is null
 then raise exception 'A resposta do defensor precisa estar registrada no servidor';end if;
 select * into clash from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if clash.attacker_id is distinct from actor
  or clash.defender_id is distinct from win.defender_id
  or clash.attack_card is distinct from win.attack_instance_id
  or attack.actor_id is distinct from actor
  or attack.attack_instance_id is distinct from win.attack_instance_id
 then raise exception 'Confronto e ataque não conferem com Burst';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'A sequência já foi registrada';end if;
 select * into queued from public.chaotic_preview_burst_equipment_responses
   where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if found and (queued.defender_id is distinct from win.defender_id
   or queued.resolution_status<>'queued_unexecuted') then
   raise exception 'Resposta de equipamento não corresponde ao defensor';end if;
 if win.status='defender_passed' then
  if win.defender_response<>'pass' or win.defensive_immunity_source is not null then
   raise exception 'Resposta PASSAR incoerente';end if;
  -- PASS is not a stack item. A queued equipment reveal was added AFTER
  -- the attack, and must be INSPECTED first (LIFO) before the attack.
  if queued.lobby_id is not null then
   steps:=jsonb_build_array(
    jsonb_build_object('order',1,'stage','inspect_queued_equipment_reveal',
      'actor','defender','source','equipment_instance',
      'equipment_name',queued.equipment_name,
      'executed',false),
    jsonb_build_object('order',2,'stage','inspect_attack',
      'actor','attacker','source','declared_attack','executed',false));
  else
   steps:=jsonb_build_array(
    jsonb_build_object('order',1,'stage','inspect_attack',
      'actor','attacker','source','declared_attack','executed',false));
  end if;
 else
  if win.defender_response<>'acknowledge_air_immunity'
   or win.defensive_immunity_source not in('rex_air','vacuum_amulet_air') then
   raise exception 'Reconhecimento de imunidade inválido';end if;
  if queued.lobby_id is not null then
   raise exception 'Revelação de equipamento ainda não executada; reconhecimento passivo não pode ser combinado no teste';end if;
  -- Check defender's passive first, then inspect the underlying attack.
  -- Neither stage is an execution, and no passive is counted as a counter-card.
  steps:=jsonb_build_array(
    jsonb_build_object('order',1,'stage','inspect_passive_air_immunity',
      'actor','defender','source',win.defensive_immunity_source,
      'executed',false),
    jsonb_build_object('order',2,'stage','inspect_attack',
      'actor','attacker','source','declared_attack','executed',false));
 end if;
 insert into public.chaotic_preview_burst_order_plans(
  lobby_id,turn_no,attacker_id,defender_id,attack_instance_id,
  defender_response,defensive_immunity_source,inspection_steps
 ) values(
  p_lobby_id,p_expected_turn,actor,win.defender_id,win.attack_instance_id,
  win.defender_response,win.defensive_immunity_source,steps
 ) returning * into result;
 return result;
end;
$fn$;

revoke all on function public.chaotic_prepare_preview_burst_order(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_burst_order(uuid,integer)
 to authenticated;