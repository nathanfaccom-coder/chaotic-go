-- Chaotic GO 0.1.28: an unresolved Mugic intent must not be silently ignored
-- by the legacy LIFO inspection, damage preview, or pass-turn RPC.
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
 priority_state public.chaotic_preview_burst_priority;
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
 -- Only an acknowledged succession of attacker then defender PASS
 -- may authorize the legacy LIFO inspection plan in test mode.
 select * into priority_state from public.chaotic_preview_burst_priority
   where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or priority_state.priority_status<>'closed_preview'
   or priority_state.consecutive_passes<>2
   or priority_state.attacker_id is distinct from actor
   or priority_state.defender_id is distinct from win.defender_id
   or (select count(*) from public.chaotic_preview_burst_priority_passes
       where lobby_id=p_lobby_id and turn_no=p_expected_turn)<>2
   or not exists(select 1 from public.chaotic_preview_burst_priority_passes
       where lobby_id=p_lobby_id and turn_no=p_expected_turn
         and pass_seq=1 and actor_id=actor)
   or not exists(select 1 from public.chaotic_preview_burst_priority_passes
       where lobby_id=p_lobby_id and turn_no=p_expected_turn
         and pass_seq=2 and actor_id=win.defender_id)
 then raise exception 'Prioridade Burst ainda não foi passada pelos dois jogadores';end if;

 if exists(select 1 from public.chaotic_preview_burst_mugic_intents mi
  where mi.lobby_id=p_lobby_id and mi.turn_no=p_expected_turn
   and mi.intent_status='queued_unexecuted')
 then raise exception 'Mugic declarada mas ainda não resolvida no Burst; cancele a intenção para continuar o treino';end if;
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

create or replace function public.chaotic_calculate_individual_preview(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_individual_damage
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid := auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 clash public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 attacker public.chaotic_preview_loadouts;
 defender public.chaotic_preview_loadouts;
 equip_a public.chaotic_preview_equipment_reveals;
 equip_d public.chaotic_preview_equipment_reveals;
 revealed_a boolean:=false;
 revealed_d boolean:=false;
 training_result public.chaotic_preview_burst_equipment_effects;
 training_wallet public.chaotic_preview_hp_wallets;
 training_applied boolean:=false;
 defender_training_stats jsonb;
 parts jsonb;
 place public.chaotic_preview_room_locations;
 terrain jsonb;
 location_elem integer:=0;
 location_delta integer:=0;
 location_energy integer:=0;
 location_id integer;
 subtotal integer;
 energy integer;
 result public.chaotic_preview_individual_damage;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
   raise exception 'Turno inválido'; end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found then raise exception 'Partida inexistente';end if;
 if actor<>m.host_id and actor<>m.guest_id then raise exception 'Não é participante';end if;
 if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
   raise exception 'Não é sua vez ou turno desatualizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala de teste 1x1 indisponível';end if;
 select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or clash.attacker_id<>actor then raise exception 'Registre confronto primeiro';end if;
 -- A defender who was offered a Burst window must be allowed to
 -- finish passing before a preview damage calculation can proceed.
 -- Legacy rooms without a Burst window remain in preview-only mode.
 if exists(select 1 from public.chaotic_preview_burst_windows w
   where w.lobby_id=p_lobby_id and w.turn_no=p_expected_turn
    and w.status='awaiting_defender') then
   raise exception 'Aguarde o defensor passar sua resposta Burst';end if;
 -- Without a verified priority round AND server inspection, even the
 -- nonofficial damage preview is premature.
 if exists(select 1 from public.chaotic_preview_burst_windows w
    where w.lobby_id=p_lobby_id and w.turn_no=p_expected_turn)
   and (
     not exists(select 1 from public.chaotic_preview_burst_priority p
       where p.lobby_id=p_lobby_id and p.turn_no=p_expected_turn
         and p.priority_status='closed_preview' and p.consecutive_passes=2
         and p.attacker_id=actor and p.defender_id=clash.defender_id)
     or not exists(select 1 from public.chaotic_preview_burst_order_plans plan
       where plan.lobby_id=p_lobby_id and plan.turn_no=p_expected_turn
         and plan.attacker_id=actor and plan.defender_id=clash.defender_id)
   ) then raise exception 'Aguarde os dois passes de prioridade e a inspeção Burst';end if;

 if exists(select 1 from public.chaotic_preview_burst_mugic_intents mi
  where mi.lobby_id=p_lobby_id and mi.turn_no=p_expected_turn
   and mi.intent_status='queued_unexecuted')
 then raise exception 'Mugic declarada mas ainda não resolvida no Burst; cancele a intenção para continuar o treino';end if;
 -- A queued reveal is NOT resolved in the official game. This separate training
 -- computation may proceed only after a corresponding server-verified effect
 -- was applied to the isolated HP / wisdom ledger.
 if exists(select 1 from public.chaotic_preview_burst_equipment_responses q
   where q.lobby_id=p_lobby_id and q.turn_no=p_expected_turn
     and q.resolution_status='queued_unexecuted') then
   select * into training_result from public.chaotic_preview_burst_equipment_effects e
    where e.lobby_id=p_lobby_id and e.turn_no=p_expected_turn
      and e.applied_to_training_ledger and not e.applied_to_official_match
      and not e.final_damage_verified and not e.official_hp_changed;
   if not found then
     raise exception 'Equipamento na corrente Burst: treino ainda não resolvido; dano indisponível';
   end if;
   if not exists (
    select 1 from public.chaotic_preview_burst_equipment_responses q
      join public.chaotic_preview_burst_order_plans plan
       on plan.lobby_id=q.lobby_id and plan.turn_no=q.turn_no
      join public.chaotic_preview_burst_windows w
       on w.lobby_id=q.lobby_id and w.turn_no=q.turn_no
    where q.lobby_id=p_lobby_id and q.turn_no=p_expected_turn
      and q.defender_id=training_result.defender_id
      and q.creature_instance_id=training_result.creature_instance_id
      and q.equipment_instance_id=training_result.equipment_instance_id
      and q.equipment_name=training_result.equipment_name
      and plan.attacker_id=actor and plan.inspection_step_count=2
      and plan.inspection_steps->0->>'stage'='inspect_queued_equipment_reveal'
      and plan.inspection_steps->1->>'stage'='inspect_attack'
      and w.status='defender_passed' and w.attacker_id=actor
      and w.defender_id=training_result.defender_id
   ) then raise exception 'Resultado experimental não corresponde à pilha de Burst';end if;
   training_applied:=true;
 end if;
 select * into attack from public.chaotic_preview_attack_instances
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or attack.actor_id<>actor
   or attack.attack_instance_id<>clash.attack_card then
   raise exception 'Ataque individual inválido ou não validado'; end if;
 select * into attacker from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=actor;
 if not found or attacker.card_instance_id<>clash.attacker_card then
    raise exception 'Ficha individual atacante incompatível';end if;
 select * into defender from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=clash.defender_id;
 if not found or defender.card_instance_id<>clash.defender_card then
    raise exception 'Ficha individual defensora incompatível';end if;
 defender_training_stats:=defender.stats;
 if training_applied then
   if training_result.defender_id is distinct from clash.defender_id
    or training_result.creature_instance_id is distinct from defender.card_instance_id
    or training_result.equipment_instance_id is distinct from defender.equipment_instance_id
    or training_result.equipment_name is distinct from defender.equipment_name
   then raise exception 'Efeito de treino não corresponde ao defensor congelado';end if;
   select * into training_wallet from public.chaotic_preview_hp_wallets
     where lobby_id=p_lobby_id and actor_id=clash.defender_id for update;
   if not found or training_wallet.creature_instance_id is distinct from defender.card_instance_id
    or training_wallet.hp_remaining is distinct from training_result.hp_after
    or training_wallet.hp_max is distinct from training_result.hp_max_after
   then raise exception 'HP de treinamento diverge do efeito aplicado';end if;
   if training_result.effect_code='wisdom_staff' then
     defender_training_stats:=pg_catalog.jsonb_set(
       defender.stats,'{s}',pg_catalog.to_jsonb(training_result.wisdom_after),true);
   end if;
 end if;
 if exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
   raise exception 'Simulação já registrada';end if;
 if not exists(
   select 1 from public.chaotic_preview_attack_hand h
   join public.chaotic_preview_attack_wallets w
    on w.lobby_id=h.lobby_id and w.actor_id=h.actor_id
   where h.lobby_id=p_lobby_id and h.actor_id=actor
     and h.attack_instance_id=attack.attack_instance_id
     and h.card_slot=attack.card_slot
     and h.card_state='spent' and h.spent_reason='attack'
     and h.spent_turn=p_expected_turn
     and w.last_draw_turn=p_expected_turn
 ) then raise exception 'Confirme primeiro o custo e a carta na mão de teste';end if;


 select * into equip_a from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=actor and revealed_turn<=p_expected_turn;
 revealed_a:=found;
 select * into equip_d from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=clash.defender_id and revealed_turn<=p_expected_turn;
 revealed_d:=found;

 parts:=public.chaotic_preview_equipment_formula(
   attack.catalog_attack_id,attacker.creature_name,attacker.stats,defender_training_stats,
   attacker.equipment_name,revealed_a,
   defender.creature_name,defender.equipment_name,revealed_d);
 select * into place from public.chaotic_preview_room_locations
  where lobby_id=p_lobby_id;
 if found then location_id:=place.catalog_location_id;end if;
 terrain:=public.chaotic_preview_location_damage(
  attack.catalog_attack_id,attacker.creature_name,defender.tribe,location_id);
 location_elem:=(terrain->>'added_fire_elemental')::integer;
 location_delta:=(terrain->>'terrain_damage_delta')::integer;
 location_energy:=(terrain->>'defender_energy_bonus')::integer;
 -- The Anel Precioso neutralizes elemental bonuses, including Magma's added fire.
 if revealed_d and pg_catalog.lower(pg_catalog.btrim(coalesce(defender.equipment_name,'')))='anel precioso'
 then location_elem:=0;end if;
 -- Anel Precioso's elemental immunity is already implemented in the legacy
 -- preview formula, but the original reveal row must stay untouched.
 if training_applied and training_result.effect_code='precious_ring_hp' then
   location_elem:=0;
 end if;
 subtotal:=case when (parts->>'subtotal') is null then null
   when (parts->>'immunity_reason') is not null then 0
   when training_applied and training_result.effect_code='precious_ring_hp'
     then greatest(0,(parts->>'subtotal')::integer
       - coalesce((parts->>'elemental')::integer,0)+location_delta)
   else greatest(0,(parts->>'subtotal')::integer+location_elem+location_delta) end;
 energy:=(defender.stats->>'e')::integer;
 if energy not between 1 and 500 then raise exception 'Energia individual inválida';end if;
 energy:=energy+location_energy;
 if training_applied then
   -- Kiru and any prior equipment effect are already reflected in the
   -- persistent test wallet. Do not add Location energy twice.
   energy:=training_wallet.hp_remaining;
 end if;
 if attack.attack_cost not between 0 and 50 then
    raise exception 'Custo inválido';end if;
 insert into public.chaotic_preview_individual_damage (
   lobby_id,turn_no,attacker_id,defender_id,attack_instance_id,catalog_attack_id,
   attack_name,attacker_instance_id,defender_instance_id,attacker_name,defender_name,
   defender_energy_initial,base_damage,elemental_bonus,attribute_bonus,
   preview_subtotal,preview_energy_remaining,calculation_status,notes,
   attack_cost,cost_status,equipment_bonus,attacker_equipment_revealed,
   defender_equipment_revealed,immunity_reason,
   location_id,location_elemental_bonus,location_damage_delta,location_energy_bonus
 ) values(
   p_lobby_id,p_expected_turn,actor,clash.defender_id,attack.attack_instance_id,
   attack.catalog_attack_id,attack.attack_name,attacker.card_instance_id,
   defender.card_instance_id,attacker.creature_name,defender.creature_name,
   energy,(parts->>'base')::integer,
   case when training_applied and training_result.effect_code='precious_ring_hp'
     then 0 else (parts->>'elemental')::integer end,
   (parts->>'attribute')::integer,subtotal,
   case when subtotal is null then null else greatest(0,energy-subtotal) end,
   parts->>'status',
   'Prévia NÃO-oficial: carta na mão e pontos debitados SOMENTE NA SIMULAÇÃO. Os três Locais ativos ajustam elementos/dano/energia indicativos; efeitos restantes (habilidades, magias, Burst, vitórias) NÃO são resolvidos. '
    || case when training_applied then
      'Efeito do equipamento validado SOMENTE NO TREINAMENTO: '||
      training_result.equipment_name||
      '. HP inicial desta prévia vem do saldo já atualizado; estado da carta e vitória oficiais inalterados. '
      else '' end
    || coalesce(parts->>'explanation',''),
   attack.attack_cost,'test_spent',
   (parts->>'equipment_bonus')::integer,revealed_a,revealed_d,
   parts->>'immunity_reason',
   location_id,location_elem,location_delta,location_energy
 ) returning * into result;
 return result;
end;
$fn$;

create or replace function public.chaotic_pass_turn(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_match_turns
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 match public.chaotic_match_turns;
 lobby public.chaotic_lobbies;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_expected_turn is null or p_expected_turn<1 then
  raise exception 'Número de turno inválido';end if;
 select * into match from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found then raise exception 'Partida não encontrada';end if;
 if actor<>match.host_id and actor<>match.guest_id then
  raise exception 'Você não participa desta partida';end if;
 if match.status<>'active' then raise exception 'Partida encerrada';end if;
 if match.current_player<>actor then raise exception 'Aguarde sua vez';end if;
 if match.turn_no<>p_expected_turn then raise exception 'O turno mudou. Atualize';end if;
 select * into lobby from public.chaotic_lobbies where id=p_lobby_id;
 if not found or lobby.status<>'ready' or lobby.expires_at<=now()
  or lobby.host_id<>match.host_id or lobby.guest_id is distinct from match.guest_id then
   raise exception 'Sala encerrada ou jogadores alterados';end if;
 if lobby.mode='1x1' and exists(
  select 1 from public.chaotic_preview_burst_windows w
  where w.lobby_id=p_lobby_id and w.turn_no=p_expected_turn
    and w.attacker_id=actor
    and (w.status='awaiting_defender'
       or not exists(select 1 from public.chaotic_preview_burst_priority p
         where p.lobby_id=w.lobby_id and p.turn_no=w.turn_no
          and p.priority_status='closed_preview' and p.consecutive_passes=2)
       or not exists(select 1 from public.chaotic_preview_burst_order_plans plan
         where plan.lobby_id=w.lobby_id and plan.turn_no=w.turn_no))
 ) then raise exception 'Finalize os dois passes de prioridade e prepare a inspeção Burst antes de passar o turno';end if;

 if exists(select 1 from public.chaotic_preview_burst_mugic_intents mi
  where mi.lobby_id=p_lobby_id and mi.turn_no=p_expected_turn
   and mi.intent_status='queued_unexecuted')
 then raise exception 'Mugic declarada mas ainda não resolvida no Burst; cancele a intenção para continuar o treino';end if;
 update public.chaotic_match_turns
  set last_player=actor,turn_no=match.turn_no+1,
   current_player=case when actor=match.host_id then match.guest_id else match.host_id end,
   status=case when match.turn_no>=120 then 'finished' else 'active' end,
   updated_at=now()
  where lobby_id=p_lobby_id returning * into match;
 insert into public.chaotic_match_events(lobby_id,seq,actor_id,event_type,turn_no)
  values(p_lobby_id,match.turn_no,actor,'pass',match.turn_no);
 return match;
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_burst_order(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_burst_order(uuid,integer) to authenticated;
revoke all on function public.chaotic_calculate_individual_preview(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_calculate_individual_preview(uuid,integer) to authenticated;
revoke all on function public.chaotic_pass_turn(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_pass_turn(uuid,integer) to authenticated;