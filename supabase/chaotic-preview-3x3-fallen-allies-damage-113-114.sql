-- Chaotic GO v0.1.50: PURGATÓRIO (113) and ESQUELETO (114).
-- Two original cards: +5 attack damage per allied KO, counted server-side.
-- Zero-damage 113 resolves without HP update or a fake damage event.
-- Modifies only training HP; no official rewards/turn winners/card assets.

alter table public.chaotic_preview_3x3_attack_spends
 drop constraint chaotic_preview_3x3_training_settlement_consistency;
alter table public.chaotic_preview_3x3_attack_spends
 add constraint chaotic_preview_3x3_training_settlement_consistency
 check((not training_damage_applied and resolution_status='paid_training_unresolved')
   or (training_damage_applied and resolution_status in (
     'training_base_damage_105_optional_reveal_pending',
     'training_base_damage_attack_lock_applied',
     'training_conditional_damage_resolved')));

alter table public.chaotic_preview_3x3_training_damage_events
 add column bonus_damage integer not null default 0
    check(bonus_damage between 0 and 10),
 add column defeated_allies_count smallint not null default 0
    check(defeated_allies_count between 0 and 2);
alter table public.chaotic_preview_3x3_training_damage_events
 drop constraint chaotic_preview_3x3_training_attack_catalog_check,
 drop constraint chaotic_preview_3x3_training_damage_range,
 drop constraint chaotic_preview_3x3_training_damage_events_check1,
 drop constraint chaotic_preview_3x3_training_damage_events_hp_after_check;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_training_conditional_attack_catalog_check
 check(
 (catalog_attack_id='105' and base_damage=5 and bonus_damage=0
  and defeated_allies_count=0 and optional_reveal_pending and not effects_fully_resolved)
 or (catalog_attack_id='111' and base_damage=10 and bonus_damage=0
  and defeated_allies_count=0 and not optional_reveal_pending and effects_fully_resolved)
 or (catalog_attack_id='112' and base_damage=5 and bonus_damage=0
  and defeated_allies_count=0 and not optional_reveal_pending and effects_fully_resolved)
 or (catalog_attack_id='113' and base_damage=0
  and bonus_damage=5*defeated_allies_count
  and not optional_reveal_pending and effects_fully_resolved)
 or (catalog_attack_id='114' and base_damage=10
  and bonus_damage=5*defeated_allies_count
  and not optional_reveal_pending and effects_fully_resolved)
 ),
 add constraint chaotic_preview_3x3_training_conditional_hp_after
 check(hp_after=greatest(0,hp_before-base_damage-bonus_damage)
       and hp_after between 0 and 500),
 add constraint chaotic_preview_3x3_training_conditional_damage_range
 check(damage_dealt between 0 and 20);

alter table public.chaotic_preview_3x3_training_knockouts
 drop constraint chaotic_preview_3x3_knockout_attack_damage_match;
alter table public.chaotic_preview_3x3_training_knockouts
 add constraint chaotic_preview_3x3_knockout_conditional_attack
 check((catalog_attack_id='105' and hp_before between 1 and 5)
    or (catalog_attack_id='111' and hp_before between 1 and 10)
    or (catalog_attack_id='112' and hp_before between 1 and 5)
    or (catalog_attack_id='113' and hp_before between 1 and 10)
    or (catalog_attack_id='114' and hp_before between 1 and 20));

create or replace function public.chaotic_apply_preview_3x3_training_fallen_allies(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_training_damage_events
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 contact public.chaotic_preview_3x3_contact_intents;
 proj public.chaotic_preview_3x3_attack_projections;
 paid public.chaotic_preview_3x3_attack_spends;
 meta public.chaotic_preview_3x3_elemental_inspections;
 creature public.chaotic_preview_3x3_creature_element_checks;
 gear public.chaotic_preview_3x3_private_equipment_checks;
 hp_def public.chaotic_preview_3x3_hp_wallets;
 hp_att public.chaotic_preview_3x3_hp_wallets;
 before_hp integer;
 after_hp integer;
 damage_points integer;
 defeated_count integer;
 unit_count integer;
 bonus_damage integer;
 expected_name text;
 expected_cost integer;
 event_row public.chaotic_preview_3x3_training_damage_events;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de dano de treino inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in(m.host_id,m.guest_id)
 then raise exception 'Apenas o atacante no turno ativo aplica dano de treino';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de treino 3x3 inválida';end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.attacker_id is distinct from actor
   or w.defender_id is distinct from
    (case when actor=m.host_id then m.guest_id else m.host_id end)
   or w.status<>'defender_passed_preview' or w.defender_passed_at is null
 then raise exception 'O defensor precisa passar a reação de treino antes do dano';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Dano já debitado neste turno (antirreplay)';end if;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into proj from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into paid from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if contact.lobby_id is null or proj.lobby_id is null or paid.lobby_id is null
  or contact.attacker_id is distinct from actor
  or contact.defender_id is distinct from w.defender_id
  or contact.attacker_slot is distinct from w.attacker_slot
  or contact.defender_slot is distinct from w.defender_slot
  or contact.damage_applied or contact.official_match_modified
  or proj.actor_id is distinct from actor
  or proj.defender_id is distinct from w.defender_id
  or proj.attacker_slot is distinct from w.attacker_slot
  or proj.defender_slot is distinct from w.defender_slot
  or proj.attack_instance_id is distinct from w.attack_instance_id
  or paid.actor_id is distinct from actor
  or paid.attack_instance_id is distinct from w.attack_instance_id
  or paid.attack_instance_id is distinct from proj.attack_instance_id
  or paid.training_attack_cost is distinct from w.training_attack_cost
  or not paid.training_points_paid or not paid.training_card_spent
  or paid.training_damage_applied or paid.official_match_modified
 then raise exception 'Contato, ataque ou pagamento de treino divergente';end if;
 if proj.catalog_attack_id not in ('113','114') then
  raise exception 'Somente ataques condicionais 113/114 estão habilitados nesta função';end if;
 damage_points:=case when proj.catalog_attack_id='113' then 0 else 10 end;
 expected_name:=case when proj.catalog_attack_id='113' then 'PURGATÓRIO' else 'ESQUELETO' end;
 expected_cost:=case when proj.catalog_attack_id='113' then 0 else 2 end;
 if proj.attack_name is distinct from expected_name
  or proj.base_damage is distinct from damage_points
  or proj.attack_cost is distinct from expected_cost
  or paid.catalog_attack_id is distinct from proj.catalog_attack_id
  or paid.training_attack_cost is distinct from expected_cost
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Dados do ataque 113/114 divergentes do catálogo original';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id=proj.catalog_attack_id
   and c.card_name=expected_name
   and c.base_damage=damage_points and c.attack_cost=expected_cost)
 then raise exception 'Referência canônica do ataque condicional ausente';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id is distinct from proj.catalog_attack_id
  or meta.base_damage is distinct from damage_points
  or meta.special_resolution<>'none'
  or meta.fire_component<>0 or meta.water_component<>0
  or meta.earth_component<>0 or meta.air_component<>0
  or meta.attacker_id is distinct from actor
  or meta.defender_id is distinct from w.defender_id
  or creature.attacker_id is distinct from actor
  or creature.defender_id is distinct from w.defender_id
  or creature.attacker_slot is distinct from w.attacker_slot
  or creature.defender_slot is distinct from w.defender_slot
  or creature.official_match_modified or creature.final_damage_calculated
 then raise exception 'Componentes ou criaturas não validados no catálogo';end if;
 select * into gear from public.chaotic_preview_3x3_private_equipment_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if gear.lobby_id is null or gear.defender_id is distinct from w.defender_id
  or gear.defender_slot is distinct from w.defender_slot
  or gear.defender_creature_instance_id is distinct from creature.defender_creature_instance_id
  or gear.equipment_status<>'no_equipment_in_slot'
  or gear.equipment_instance_id is not null
 then raise exception 'Resolva a defesa: somente defensor SEM equipamento é elegível';end if;
 select * into hp_att from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=w.attacker_slot for update;
 select * into hp_def from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=w.defender_id and position=w.defender_slot for update;
 if hp_att.lobby_id is null or hp_def.lobby_id is null
  or hp_att.creature_instance_id is distinct from contact.attacker_creature_instance_id
  or hp_def.creature_instance_id is distinct from contact.defender_creature_instance_id
  or hp_att.creature_instance_id is distinct from creature.attacker_creature_instance_id
  or hp_def.creature_instance_id is distinct from creature.defender_creature_instance_id
  or hp_att.hp_remaining is distinct from contact.attacker_hp_at_contact
  or hp_def.hp_remaining is distinct from contact.defender_hp_at_contact
  or hp_att.hp_remaining<1 or hp_def.hp_remaining<1
  or hp_def.damage_events>=120
 then raise exception 'HP alterado ou criatura diferente do contato';end if;
 -- Only the server-owned 3-slot HP wallets represent the graveyard
 -- during this incomplete 3x3 training. Never accept counts from the browser.
 select count(*),count(*) filter(where hp_remaining=0)
 into unit_count,defeated_count
 from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=p_lobby_id and actor_id=actor;
 if unit_count<>3 or defeated_count not between 0 and 2 then
  raise exception 'Formação ou cemitério do atacante inválidos no treino';end if;
 bonus_damage:=5*defeated_count;
 before_hp:=hp_def.hp_remaining;
 after_hp:=greatest(0,before_hp-damage_points-bonus_damage);
 -- PURGATÓRIO with no fallen allies resolves for zero damage: do not
 -- emit an HP update, damage event counter or KO when no HP changed.
 if after_hp<before_hp then
   update public.chaotic_preview_3x3_hp_wallets
     set hp_remaining=after_hp,damage_events=damage_events+1
     where lobby_id=p_lobby_id and actor_id=w.defender_id and position=w.defender_slot;
 end if;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_conditional_damage_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,base_damage,bonus_damage,defeated_allies_count,
  hp_before,hp_after,damage_dealt,optional_reveal_pending,effects_fully_resolved
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,proj.catalog_attack_id,damage_points,bonus_damage,defeated_count,
  before_hp,after_hp,before_hp-after_hp,false,true
 ) returning * into event_row;
 return event_row;
end;
$fn$;
revoke all on function public.chaotic_apply_preview_3x3_training_fallen_allies(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_fallen_allies(uuid,integer)
 to authenticated;

-- The KO trigger is a controlled internal function, never callable directly.
create or replace function public.chaotic_record_preview_3x3_training_knockout()
 returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 w public.chaotic_preview_3x3_defense_windows;
 paid public.chaotic_preview_3x3_attack_spends;
 n integer;
 dead_count integer;
 alive_count integer;
 conditional_base integer;
 expected_damage integer;
begin
 if new.hp_remaining<>0 or old.hp_remaining<=0
 then return new;end if;

 select * into m from public.chaotic_match_turns
 where lobby_id=new.lobby_id for update;
 if actor is null or m.lobby_id is null or m.status<>'active'
 or m.current_player is distinct from actor
 or actor not in(m.host_id,m.guest_id)
 or new.actor_id not in(m.host_id,m.guest_id)
 or actor=new.actor_id
 then raise exception 'Nocaute de treino exige atacante autenticado na partida';end if;

 select * into w from public.chaotic_preview_3x3_defense_windows
 where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 select * into paid from public.chaotic_preview_3x3_attack_spends
 where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 if w.lobby_id is null or paid.lobby_id is null
 or w.attacker_id is distinct from actor
 or w.defender_id is distinct from new.actor_id
 or w.defender_slot is distinct from new.position
 or w.status<>'defender_passed_preview'
 or paid.actor_id is distinct from actor
 or paid.catalog_attack_id not in ('105','111','112','113','114')
 or paid.attack_instance_id is distinct from w.attack_instance_id
 or not paid.training_points_paid or not paid.training_card_spent
 or paid.training_damage_applied
 or old.creature_instance_id is distinct from new.creature_instance_id
 or old.creature_name is distinct from new.creature_name
 or old.hp_max is distinct from new.hp_max
 or new.damage_events is distinct from old.damage_events+1
 then raise exception 'Nocaute 3x3 não corresponde ao ataque pago';end if;
 -- Dynamic KO verification: the attacker must have exactly three own wallets,
 -- a living attacking champion and a server-derived graveyard.
 select count(*),count(*) filter(where hp_remaining=0)
 into alive_count,dead_count from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=new.lobby_id and actor_id=actor;
 if alive_count<>3 or dead_count not between 0 and 2 then
  raise exception 'Contagem de campeões derrotados inválida';end if;
 expected_damage:=case paid.catalog_attack_id
  when '111' then 10 when '114' then 10+5*dead_count
  when '113' then 5*dead_count else 5 end;
 if expected_damage<=0
  or new.hp_remaining is distinct from greatest(0,old.hp_remaining-expected_damage)
  or old.hp_remaining>expected_damage
 then raise exception 'Dano de nocaute não corresponde ao total condicional';end if;

 insert into public.chaotic_preview_3x3_training_knockouts(
  lobby_id,turn_no,attacker_id,defender_id,defender_slot,
  defender_creature_instance_id,defender_creature_name,attack_instance_id,
  catalog_attack_id,hp_before
 ) values(
  new.lobby_id,m.turn_no,actor,new.actor_id,new.position,
  new.creature_instance_id,new.creature_name,w.attack_instance_id,
  paid.catalog_attack_id,old.hp_remaining
 );

 select count(*), count(*) filter(where hp_remaining=0)
 into n,dead_count from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=new.lobby_id and actor_id=new.actor_id;
 if n=3 and dead_count=3 then
  insert into public.chaotic_preview_3x3_training_outcomes(
    lobby_id,decided_turn,winner_id,defeated_id
  ) values(new.lobby_id,m.turn_no,actor,new.actor_id)
  on conflict(lobby_id) do nothing;
 end if;
 return new;
end;
$fn$;

