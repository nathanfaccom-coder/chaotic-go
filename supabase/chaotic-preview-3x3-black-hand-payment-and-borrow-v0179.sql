-- Chaotic GO v0.1.79: original Mão Negra 102 training-only payment and theft.
-- Two steps: pay original 102 (0 points), open window, defender passes,
-- then atomically steal one random private original attack and settle 0 damage.
-- A borrowed attack remains NON-playable pending separate secure resolver.
begin;
alter table public.chaotic_preview_3x3_attack_spends drop constraint chaotic_preview_3x3_training_settlement_consistency;
alter table public.chaotic_preview_3x3_attack_spends
 add constraint chaotic_preview_3x3_training_settlement_consistency check (
  (not training_damage_applied and resolution_status='paid_training_unresolved')
  or (training_damage_applied and resolution_status in(
  'training_base_damage_105_optional_reveal_pending','training_base_damage_105_reveal_resolved',
  'training_fire_104_die_resolved','training_speed_108_bonus_draw_resolved',
  'training_sopro_115_random_discard_resolved','training_tornado_109_reshuffle_two_resolved',
  'training_base_damage_attack_lock_applied','training_conditional_damage_resolved',
  'training_elemental_acid_101_native_only','training_elemental_vine_107_attack_draw_lock_partial',
  'training_elemental_sonar_110_rex_immunity_search_pending',
  'training_elemental_sonar_110_search_complete',
  'training_black_hand_102_borrow_resolved')));

-- Chaotic GO v0.1.73: allow TORNADO 109 only with natural Ar and initialized opponent hand.
CREATE OR REPLACE FUNCTION public.chaotic_pay_preview_3x3_black_hand(p_lobby_id uuid, p_expected_turn integer)
 RETURNS chaotic_preview_3x3_attack_spends
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 projection public.chaotic_preview_3x3_attack_projections;
 inspection public.chaotic_preview_3x3_cost_inspections;
 encounter public.chaotic_preview_3x3_contact_intents;
 wallet public.chaotic_preview_3x3_attack_wallets;
 card public.chaotic_preview_3x3_attack_hand;
 available_points integer;
 new_spent integer;
 spend_event public.chaotic_preview_3x3_attack_spends;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de uso de ataque inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente o atacante da vez pode gastar no treinamento';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 de treinamento não está pronta';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Ataque já foi gasto neste turno experimental';end if;
 if exists(select 1 from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Outro Clash/Burst impede gasto paralelo no mesmo turno';end if;
 select * into encounter from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or encounter.attacker_id is distinct from actor
  or encounter.defender_id is distinct from
    (case when m.host_id=actor then m.guest_id else m.host_id end)
  or encounter.contact_status<>'awaiting_validated_attack_preview'
  or encounter.damage_applied or encounter.attack_card_validated
  or encounter.official_match_modified or encounter.official_hp_changed
 then raise exception 'Contato 3x3 incorreto ou já resolvido';end if;
 select * into projection from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or projection.actor_id is distinct from actor
  or projection.defender_id is distinct from encounter.defender_id
  or projection.attacker_slot is distinct from encounter.attacker_slot
  or projection.defender_slot is distinct from encounter.defender_slot
  or projection.defender_hp_before is distinct from encounter.defender_hp_at_contact
  or projection.attack_cost_paid or projection.training_hp_changed
  or projection.original_card_consumed or projection.official_match_modified
 then raise exception 'A projeção não corresponde ao contato original';end if;
 -- Only catalog attacks with an implemented experimental damage RPC can
 -- be PAID. Other original cards may be projected/read, but not consumed:
 -- an unresolved paid card would block passing the turn indefinitely.
 -- Partial effects (for example 107) retain the existing training-only scope.
 if projection.catalog_attack_id<>'102' or projection.attack_name<>'Mão Negra' or projection.attack_cost<>0 or projection.base_damage<>0
 then raise exception
  'Ataque % ainda não possui dano experimental 3x3; cancele o contato sem gastar pontos',
  projection.attack_name;
 end if;
 if coalesce((public.chaotic_preview_3x3_black_hand_readiness(p_lobby_id,p_expected_turn)->>'possible')::boolean,false) is not true
 then raise exception 'Mão Negra: adversário sem carta, mão cheia ou pré-requisitos não atendidos';end if;
 select * into inspection from public.chaotic_preview_3x3_cost_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or inspection.actor_id is distinct from actor
  or inspection.attack_instance_id is distinct from projection.attack_instance_id
  or inspection.card_slot is distinct from projection.attack_card_slot
  or inspection.catalog_attack_id is distinct from projection.catalog_attack_id
  or inspection.attack_cost is distinct from projection.attack_cost
  or inspection.hand_verified is distinct from true
  or not inspection.can_afford or inspection.actual_attack_cost_paid
  or inspection.original_card_consumed or inspection.training_hp_changed
  or inspection.official_match_modified
 then raise exception 'Sem prova de carta na mão ou custo insuficiente';end if;
 select * into wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found or wallet.deck_slot is distinct from projection.attack_deck_slot
  or wallet.last_draw_turn<>p_expected_turn
  or wallet.prepared_turn>p_expected_turn
  or (p_expected_turn-wallet.prepared_turn)%2<>0
  or wallet.spent_points not between 0 and 65
  or wallet.official_points_changed or wallet.official_match_modified
 then raise exception 'Carteira de ataque não sincronizada ou inválida';end if;
 available_points:=3+(p_expected_turn-wallet.prepared_turn)/2-wallet.spent_points;
 if available_points not between 0 and 65
  or available_points is distinct from inspection.points_available
  or inspection.points_after_if_paid is distinct from
       (available_points-projection.attack_cost)
  or available_points<projection.attack_cost
 then raise exception 'Pontos de treino mudaram ou não bastam para pagar';end if;
 select * into card from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor
  and card_slot=projection.attack_card_slot for update;
 if not found or card.card_state<>'hand'
  or card.attack_instance_id is distinct from projection.attack_instance_id
  or card.spent_turn is not null or card.original_card_consumed
 then raise exception 'Ataque já utilizado ou não está na sua própria mão';end if;
 new_spent:=wallet.spent_points+projection.attack_cost;
 if new_spent not between 0 and 65 then raise exception 'Gasto acumulado inválido';end if;
 update public.chaotic_preview_3x3_attack_wallets
  set spent_points=new_spent
  where lobby_id=p_lobby_id and actor_id=actor;
 update public.chaotic_preview_3x3_attack_hand
  set card_state='spent',spent_turn=p_expected_turn,spent_reason='attack'
  where lobby_id=p_lobby_id and actor_id=actor and card_slot=card.card_slot;
 insert into public.chaotic_preview_3x3_attack_spends(
  lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
  catalog_attack_id,training_attack_cost,points_before,points_after
 ) values(
  p_lobby_id,p_expected_turn,actor,projection.attack_deck_slot,
  projection.attack_card_slot,projection.attack_instance_id,
  projection.catalog_attack_id,projection.attack_cost,
  available_points,available_points-projection.attack_cost
 ) returning * into spend_event;
 return spend_event;
end;
$function$;

revoke all on function public.chaotic_pay_preview_3x3_black_hand(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_pay_preview_3x3_black_hand(uuid,integer) to authenticated;
create or replace function public.chaotic_resolve_preview_3x3_black_hand(p_lobby_id uuid,p_expected_turn integer)
returns jsonb language plpgsql security definer set search_path=''
as $resolve_102$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 proj public.chaotic_preview_3x3_attack_projections;
 paid public.chaotic_preview_3x3_attack_spends;
 loan uuid;
 details jsonb;
 changed integer;
begin
 if actor is null or p_lobby_id is null or p_expected_turn not between 1 and 120
 then raise exception 'Resolução 102 inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null or m.status<>'active'
  or m.turn_no<>p_expected_turn or m.current_player is distinct from actor
  or actor not in(m.host_id,m.guest_id)
  or l.mode<>'3x3' or l.status<>'ready'
  or l.expires_at<=pg_catalog.statement_timestamp()
  or l.host_id is distinct from m.host_id
  or l.guest_id is distinct from m.guest_id
 then raise exception 'Somente o atacante no turno 3x3 pode resolver 102';end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into proj from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into paid from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if w.lobby_id is null or proj.lobby_id is null or paid.lobby_id is null
  or w.attacker_id is distinct from actor
  or w.defender_id is distinct from (case when actor=m.host_id then m.guest_id else m.host_id end)
  or w.status<>'defender_passed_preview' or w.defender_passed_at is null
  or w.attack_instance_id is distinct from proj.attack_instance_id
  or w.training_attack_cost<>0
  or proj.actor_id is distinct from actor or proj.defender_id is distinct from w.defender_id
  or proj.attacker_slot is distinct from w.attacker_slot
  or proj.defender_slot is distinct from w.defender_slot
  or proj.catalog_attack_id<>'102' or proj.attack_name<>'Mão Negra'
  or proj.attack_cost<>0 or proj.base_damage<>0
  or paid.actor_id is distinct from actor or paid.catalog_attack_id<>'102'
  or paid.training_attack_cost<>0
  or paid.attack_instance_id is distinct from w.attack_instance_id
  or not paid.training_points_paid or not paid.training_card_spent
  or paid.training_damage_applied or paid.resolution_status<>'paid_training_unresolved'
 then raise exception '102 exige pagamento e passe defensivo, sem replay';end if;
 loan:=public.chaotic_internal_hold_preview_3x3_black_hand(p_lobby_id,p_expected_turn);
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_black_hand_102_borrow_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor
    and catalog_attack_id='102' and not training_damage_applied;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception '102 efeito duplicado';end if;
 details:=public.chaotic_get_preview_3x3_borrowed_attacks(p_lobby_id);
 return pg_catalog.jsonb_build_object(
  'custody_id',loan,
  'borrowed_attacks',details->'borrowed_attacks',
  'training_effect_settled',true,'borrowed_attack_playable',false,
  'original_owner_changed',false,'official_match_modified',false,
  'damage_applied',false);
end;
$resolve_102$;

revoke all on function public.chaotic_resolve_preview_3x3_black_hand(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_resolve_preview_3x3_black_hand(uuid,integer) to authenticated;
commit;
