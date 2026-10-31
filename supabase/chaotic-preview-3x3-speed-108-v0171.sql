-- Chaotic GO v0.1.71: SPEED (108), zero-damage bonus private draw.
begin;
alter table public.chaotic_preview_3x3_training_damage_events
 add column if not exists speed_drew_card boolean;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_speed_private_draw_check check (
  (catalog_attack_id='108' and speed_drew_card is not null)
  or (catalog_attack_id<>'108' and speed_drew_card is null)
 );
do $constraints$
declare expr text;
begin
 select pg_get_constraintdef(oid) into expr from pg_constraint
  where conrelid='public.chaotic_preview_3x3_attack_spends'::regclass
  and conname='chaotic_preview_3x3_training_settlement_consistency';
 if expr not like '%training_fire_104_die_resolved%' then
  raise exception 'Previous 104 training status missing';end if;
 expr:=replace(expr,'''training_fire_104_die_resolved''::text,',
  '''training_fire_104_die_resolved''::text, ''training_speed_108_bonus_draw_resolved''::text,');
 execute 'alter table public.chaotic_preview_3x3_attack_spends drop constraint chaotic_preview_3x3_training_settlement_consistency';
 execute 'alter table public.chaotic_preview_3x3_attack_spends add constraint chaotic_preview_3x3_training_settlement_consistency '||expr;
 select pg_get_constraintdef(oid) into expr from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
  and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if expr not like '%fire_die_roll%' then
  raise exception 'Previous 104 damage constraint missing';end if;
 expr:=substr(expr,1,length(expr)-1)||
  ' OR (catalog_attack_id=''108''::text AND speed_drew_card is not null
   AND base_damage=0 AND bonus_damage=0 AND defeated_allies_count=0
   AND elemental_bonus_damage=0 AND immunity_prevented_damage=0
   AND NOT optional_reveal_pending AND effects_fully_resolved))';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events drop constraint chaotic_preview_3x3_training_elemental_attack_catalog_check';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events add constraint chaotic_preview_3x3_training_elemental_attack_catalog_check '||expr;
end $constraints$;
CREATE OR REPLACE FUNCTION public.chaotic_apply_preview_3x3_training_speed_108(p_lobby_id uuid, p_expected_turn integer)
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
 attack_wallet public.chaotic_preview_3x3_attack_wallets;
 next_card public.chaotic_preview_3x3_attack_hand;
 n_hand integer;
 n_deck integer;
 recycled_count integer;
 cycle integer;
 actual_cards integer;
 drew boolean:=false;
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
 if proj.catalog_attack_id<>'108' or proj.attack_name<>'SPEED'
  or proj.base_damage<>0 or proj.attack_cost<>0
  or paid.catalog_attack_id<>'108' or paid.training_attack_cost<>0
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Somente SPEED original (108, custo 0, compra 1 carta) está habilitado';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id='108' and c.card_name='SPEED'
   and c.base_damage=0 and c.attack_cost=0
   and c.effect_text='Compre mais 1 carta do monte de cartas de ataque.')
 then raise exception 'Referência original do SPEED 108 alterada';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id<>'108' or meta.base_damage<>0
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
 -- The bonus draw is private. Never return card slot or instance ID
 -- in the public training damage event or the RPC result.
 select * into attack_wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if attack_wallet.lobby_id is null
   or attack_wallet.last_draw_turn<>p_expected_turn
   or attack_wallet.prepared_turn>p_expected_turn
   or (p_expected_turn-attack_wallet.prepared_turn)%2<>0
 then raise exception 'Sincronize a mão de treino antes de usar SPEED';end if;
 select count(*),count(*) filter(where card_state='hand'),
   count(*) filter(where card_state='deck')
 into actual_cards,n_hand,n_deck
 from public.chaotic_preview_3x3_attack_hand
 where lobby_id=p_lobby_id and actor_id=actor;
 if actual_cards<>attack_wallet.total_cards or n_hand>5
 then raise exception 'Baralho de treino inconsistente ou mão acima do limite';end if;
 cycle:=attack_wallet.recycle_cycles;
 if n_hand<5 then
  if n_deck=0 then
   select count(*) into recycled_count
   from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_state='spent';
   if recycled_count>0 then
    cycle:=cycle+1;
    if cycle>120 then raise exception 'Limite de reciclagens atingido';end if;
    update public.chaotic_preview_3x3_attack_hand
     set card_state='deck',spent_turn=null,spent_reason=null,
         draw_cycle=cycle,recycle_priority=pg_catalog.gen_random_uuid()
     where lobby_id=p_lobby_id and actor_id=actor and card_state='spent';
    update public.chaotic_preview_3x3_attack_wallets
     set recycle_cycles=cycle
     where lobby_id=p_lobby_id and actor_id=actor;
   end if;
  end if;
  select * into next_card from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_state='deck'
   order by draw_cycle,recycle_priority nulls first,draw_position limit 1 for update;
  if found then
   update public.chaotic_preview_3x3_attack_hand
    set card_state='hand' where lobby_id=p_lobby_id
      and actor_id=actor and card_slot=next_card.card_slot;
   drew:=true;
  end if;
 end if;
 before_hp:=hp_def.hp_remaining;
 after_hp:=before_hp;
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,base_damage,hp_before,hp_after,
  damage_dealt,optional_reveal_pending,effects_fully_resolved,speed_drew_card
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,'108',0,before_hp,after_hp,0,false,true,drew
 ) returning * into event_row;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,resolution_status='training_speed_108_bonus_draw_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 return event_row;
end;
$function$
;
revoke all on function public.chaotic_apply_preview_3x3_training_speed_108(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_speed_108(uuid,integer) to authenticated;
commit;