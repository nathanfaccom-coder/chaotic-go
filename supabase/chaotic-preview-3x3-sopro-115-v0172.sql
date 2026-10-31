-- Chaotic GO v0.1.72: SOPRO (115) random opponent discard.
-- Preserves original decks and card ownership, avoids exposing the selected card.
begin;
alter table public.chaotic_preview_3x3_training_damage_events
 add column if not exists sopro_discarded_card boolean;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_sopro_private_discard_check check (
 (catalog_attack_id='115' and sopro_discarded_card is not null)
 or (catalog_attack_id<>'115' and sopro_discarded_card is null)
);
do $constraints$
declare expr text;
begin
 select pg_get_constraintdef(oid) into expr from pg_constraint
  where conrelid='public.chaotic_preview_3x3_attack_spends'::regclass
   and conname='chaotic_preview_3x3_training_settlement_consistency';
 if expr not like '%training_speed_108_bonus_draw_resolved%' then
  raise exception 'Missing 108 settlement baseline';end if;
 expr:=replace(expr,'''training_speed_108_bonus_draw_resolved''::text,',
   '''training_speed_108_bonus_draw_resolved''::text, ''training_sopro_115_random_discard_resolved''::text,');
 execute 'alter table public.chaotic_preview_3x3_attack_spends drop constraint chaotic_preview_3x3_training_settlement_consistency';
 execute 'alter table public.chaotic_preview_3x3_attack_spends add constraint chaotic_preview_3x3_training_settlement_consistency '||expr;
 select pg_get_constraintdef(oid) into expr from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
   and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if expr not like '%speed_drew_card%' then raise exception 'Missing 108 catalog baseline';end if;
 expr:=substr(expr,1,length(expr)-1)||
  ' OR (catalog_attack_id=''115''::text AND sopro_discarded_card is not null
   AND base_damage=0 AND bonus_damage=0 AND defeated_allies_count=0
   AND elemental_bonus_damage=0 AND immunity_prevented_damage=0
   AND NOT optional_reveal_pending AND effects_fully_resolved))';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events drop constraint chaotic_preview_3x3_training_elemental_attack_catalog_check';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events add constraint chaotic_preview_3x3_training_elemental_attack_catalog_check '||expr;
end $constraints$;
CREATE OR REPLACE FUNCTION public.chaotic_apply_preview_3x3_training_sopro_115(p_lobby_id uuid, p_expected_turn integer)
 RETURNS chaotic_preview_3x3_training_damage_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 victim_card public.chaotic_preview_3x3_attack_hand;
 discarded boolean:=false;
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
 if proj.catalog_attack_id<>'115' or proj.attack_name<>'SOPRO'
  or proj.base_damage<>0 or proj.attack_cost<>0
  or paid.catalog_attack_id<>'115' or paid.training_attack_cost<>0
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Somente SOPRO original (115, custo 0, descarte aleatório) está habilitado';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id='115' and c.card_name='SOPRO'
   and c.base_damage=0 and c.attack_cost=0
   and c.effect_text='Pegue uma carta aleatória de ataque da mão do seu oponente e descarte.')
 then raise exception 'Referência original do SOPRO 115 alterada';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id<>'115' or meta.base_damage<>0
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
 -- The target is an existing PRIVATE hand card of the defending user.
 -- No card crosses ownership boundaries; the selection is server-random.
 -- The existing locked match row serializes all turn effects across clients.
 select * into victim_card
 from public.chaotic_preview_3x3_attack_hand
 where lobby_id=p_lobby_id and actor_id=w.defender_id and card_state='hand'
 order by pg_catalog.random() limit 1 for update;
 if found then
   update public.chaotic_preview_3x3_attack_hand
     set card_state='spent',spent_turn=p_expected_turn,spent_reason='sopro_115'
     where lobby_id=p_lobby_id and actor_id=w.defender_id
       and card_slot=victim_card.card_slot and card_state='hand';
   if not found then raise exception 'Carta privada mudou durante SOPRO';end if;
   discarded:=true;
 end if;
 before_hp:=hp_def.hp_remaining;
 after_hp:=before_hp;
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,base_damage,hp_before,hp_after,
  damage_dealt,optional_reveal_pending,effects_fully_resolved,sopro_discarded_card
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,'115',0,before_hp,after_hp,0,false,true,discarded
 ) returning * into event_row;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_sopro_115_random_discard_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 return event_row;
end;
$function$
;
revoke all on function public.chaotic_apply_preview_3x3_training_sopro_115(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_sopro_115(uuid,integer) to authenticated;
commit;
