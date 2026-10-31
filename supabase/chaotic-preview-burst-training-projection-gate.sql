-- Chaotic GO 0.1.26: gate hypothetical HP projection on verified Burst inspection.
-- The original deck, official HP, DNA, coins, XP and victory remain untouched.
create or replace function public.chaotic_apply_preview_hp_projection(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 dmg public.chaotic_preview_individual_damage;
 attack public.chaotic_preview_attack_instances;
 card public.chaotic_preview_attack_hand;
 unit_a public.chaotic_preview_hp_wallets;
 unit_d public.chaotic_preview_hp_wallets;
 remaining integer;
 burst_window public.chaotic_preview_burst_windows;
 burst_plan public.chaotic_preview_burst_order_plans;
 burst_queue public.chaotic_preview_burst_equipment_responses;
 burst_effect public.chaotic_preview_burst_equipment_effects;
 has_burst_equipment boolean:=false;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.current_player<>actor
  or m.turn_no<>p_expected_turn or actor not in (m.host_id,m.guest_id)
 then raise exception 'Turno ou participante não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into dmg from public.chaotic_preview_individual_damage
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or dmg.attacker_id<>actor or dmg.defender_id not in(m.host_id,m.guest_id)
  or dmg.defender_id=actor or dmg.cost_status<>'test_spent'
  or dmg.calculation_status<>'partial_estimate'
  or dmg.preview_subtotal is null or dmg.preview_subtotal not between 0 and 1500
 then raise exception 'Dano ainda é indeterminado ou não foi pago no teste';end if;
 -- 0.1.26: Training projections require a server-inspected Burst sequence.
 select * into burst_window from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if found then
   select * into burst_plan from public.chaotic_preview_burst_order_plans
     where lobby_id=p_lobby_id and turn_no=p_expected_turn;
   if not found or burst_window.attacker_id is distinct from actor
     or burst_window.defender_id is distinct from dmg.defender_id
     or burst_window.attack_instance_id is distinct from dmg.attack_instance_id
     or burst_window.status not in ('defender_passed','defender_immunity_noted')
     or burst_window.defender_responded_at is null
     or burst_plan.attacker_id is distinct from actor
     or burst_plan.defender_id is distinct from dmg.defender_id
     or burst_plan.attack_instance_id is distinct from dmg.attack_instance_id
     or burst_plan.burst_stack_executed or burst_plan.final_damage_verified
     or burst_plan.official_match_modified
   then raise exception 'Projeção bloqueada: resposta ou inspeção Burst incompleta';end if;
   select * into burst_queue from public.chaotic_preview_burst_equipment_responses
     where lobby_id=p_lobby_id and turn_no=p_expected_turn;
   has_burst_equipment:=found;
   if has_burst_equipment then
     select * into burst_effect from public.chaotic_preview_burst_equipment_effects
       where lobby_id=p_lobby_id and turn_no=p_expected_turn;
     if not found or burst_plan.defender_response<>'pass'
       or burst_window.status<>'defender_passed'
       or burst_plan.inspection_step_count<>2
       or burst_plan.inspection_steps->0->>'stage'<>'inspect_queued_equipment_reveal'
       or burst_plan.inspection_steps->1->>'stage'<>'inspect_attack'
       or burst_queue.defender_id is distinct from dmg.defender_id
       or burst_queue.resolution_status<>'queued_unexecuted'
       or burst_effect.defender_id is distinct from burst_queue.defender_id
       or burst_effect.creature_instance_id is distinct from burst_queue.creature_instance_id
       or burst_effect.equipment_instance_id is distinct from burst_queue.equipment_instance_id
       or burst_effect.equipment_name is distinct from burst_queue.equipment_name
       or not burst_effect.applied_to_training_ledger
       or burst_effect.applied_to_official_match or burst_effect.official_hp_changed
       or burst_effect.final_damage_verified
       or burst_effect.hp_after is distinct from dmg.defender_energy_initial
     then raise exception 'Projeção bloqueada: equipamento Burst não reconciliado no treino';end if;
   elsif not (
     (burst_plan.inspection_step_count=1
       and burst_window.status='defender_passed'
       and burst_plan.inspection_steps->0->>'stage'='inspect_attack')
     or (burst_plan.inspection_step_count=2
       and burst_window.status='defender_immunity_noted'
       and burst_plan.defensive_immunity_source is not null
       and burst_plan.inspection_steps->0->>'stage'='inspect_passive_air_immunity'
       and burst_plan.inspection_steps->1->>'stage'='inspect_attack')
   ) then raise exception 'Projeção bloqueada: plano de inspeção Burst incompatível';end if;
 end if;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or attack.actor_id<>actor
  or attack.attack_instance_id is distinct from dmg.attack_instance_id
  or attack.catalog_attack_id is distinct from dmg.catalog_attack_id
 then raise exception 'Ataque de teste não corresponde ao dano simulado';end if;
 select * into card from public.chaotic_preview_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor
  and attack_instance_id=attack.attack_instance_id;
 if not found or card.card_state<>'spent' or card.spent_reason<>'attack'
  or card.spent_turn<>p_expected_turn
 then raise exception 'Carta não foi paga nesta vez';end if;
 if exists(select 1 from public.chaotic_preview_hp_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Dano de teste já acumulado neste turno';end if;
 select * into unit_a from public.chaotic_preview_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into unit_d from public.chaotic_preview_hp_wallets
  where lobby_id=p_lobby_id and actor_id=dmg.defender_id for update;
 if unit_a.creature_instance_id is distinct from dmg.attacker_instance_id
  or unit_d.creature_instance_id is distinct from dmg.defender_instance_id
  or unit_a.location_id is distinct from unit_d.location_id
  or unit_d.location_id is distinct from dmg.location_id
  or unit_a.hp_remaining<=0 or unit_d.hp_remaining<=0
 then raise exception 'HP de teste não corresponde às criaturas/Local ou já está zerado';end if;
 if has_burst_equipment and (
   unit_d.hp_remaining is distinct from dmg.defender_energy_initial
   or unit_d.hp_max is distinct from burst_effect.hp_max_after
 ) then raise exception 'Projeção bloqueada: HP do treino mudou após a prévia';end if;
 remaining:=public.chaotic_preview_hp_remainder(unit_d.hp_remaining,dmg.preview_subtotal);
 update public.chaotic_preview_hp_wallets
  set hp_remaining=remaining,projected_hits=projected_hits+1
  where lobby_id=p_lobby_id and actor_id=dmg.defender_id;
 insert into public.chaotic_preview_hp_events
 (lobby_id,turn_no,attacker_id,victim_id,attack_instance_id,victim_creature_instance_id,
  hp_before,hp_after,indicative_damage,hypothetical_applied_damage)
 values (p_lobby_id,p_expected_turn,actor,dmg.defender_id,dmg.attack_instance_id,
  dmg.defender_instance_id,unit_d.hp_remaining,remaining,dmg.preview_subtotal,
  unit_d.hp_remaining-remaining);
 return pg_catalog.jsonb_build_object('projection','hypothetical_partial_damage',
  'turn_no',p_expected_turn,'victim_id',dmg.defender_id,
  'hp_before',unit_d.hp_remaining,'hp_after',remaining,
  'indicative_damage',dmg.preview_subtotal,
  'hypothetical_applied_damage',unit_d.hp_remaining-remaining,
  'official_hp_changed',false,'final_damage_verified',false);
end;
$fn$;
revoke all on function public.chaotic_apply_preview_hp_projection(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_hp_projection(uuid,integer) to authenticated;
