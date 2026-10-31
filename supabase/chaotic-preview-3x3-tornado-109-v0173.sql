-- Chaotic GO v0.1.73: TORNADO 109, natural Air required;
-- shuffle opponent's private hand back into own deck and draw exactly up to 2.
-- No borrowed/duplicated cards or official resources.
begin;
alter table public.chaotic_preview_3x3_training_damage_events
 add column if not exists tornado_shuffled_count smallint;
alter table public.chaotic_preview_3x3_training_damage_events
 add column if not exists tornado_drawn_count smallint;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_tornado_private_count_check check (
  (catalog_attack_id='109' and tornado_shuffled_count between 0 and 5
   and tornado_drawn_count between 0 and 2)
  or (catalog_attack_id<>'109' and tornado_shuffled_count is null
   and tornado_drawn_count is null)
 );
do $constraints$
declare expr text;
begin
 select pg_get_constraintdef(oid) into expr from pg_constraint
  where conrelid='public.chaotic_preview_3x3_attack_spends'::regclass
   and conname='chaotic_preview_3x3_training_settlement_consistency';
 if expr not like '%training_sopro_115_random_discard_resolved%'
 then raise exception 'Missing 115 settlement baseline';end if;
 expr:=replace(expr,'''training_sopro_115_random_discard_resolved''::text,',
  '''training_sopro_115_random_discard_resolved''::text, ''training_tornado_109_reshuffle_two_resolved''::text,');
 execute 'alter table public.chaotic_preview_3x3_attack_spends drop constraint chaotic_preview_3x3_training_settlement_consistency';
 execute 'alter table public.chaotic_preview_3x3_attack_spends add constraint chaotic_preview_3x3_training_settlement_consistency '||expr;
 select pg_get_constraintdef(oid) into expr from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
   and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if expr not like '%sopro_discarded_card%' then raise exception 'Missing 115 catalog baseline';end if;
 expr:=substr(expr,1,length(expr)-1)||
 ' OR (catalog_attack_id=''109''::text AND tornado_shuffled_count between 0 and 5
  AND tornado_drawn_count between 0 and 2 AND base_damage=0
  AND bonus_damage=0 AND defeated_allies_count=0
  AND elemental_bonus_damage=0 AND immunity_prevented_damage=0
  AND NOT optional_reveal_pending AND effects_fully_resolved))';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events drop constraint chaotic_preview_3x3_training_elemental_attack_catalog_check';
 execute 'alter table public.chaotic_preview_3x3_training_damage_events add constraint chaotic_preview_3x3_training_elemental_attack_catalog_check '||expr;
end $constraints$;
CREATE OR REPLACE FUNCTION public.chaotic_apply_preview_3x3_training_tornado_109(p_lobby_id uuid, p_expected_turn integer)
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
 target_wallet public.chaotic_preview_3x3_attack_wallets;
 victim_card public.chaotic_preview_3x3_attack_hand;
 shuffled_count integer:=0;
 drawn_count integer:=0;
 total_count integer:=0;
 hand_count integer:=0;
 i integer;
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
 if proj.catalog_attack_id<>'109' or proj.attack_name<>'TORNADO'
  or proj.base_damage<>0 or proj.attack_cost<>0
  or paid.catalog_attack_id<>'109' or paid.training_attack_cost<>0
  or proj.defender_hp_before is distinct from contact.defender_hp_at_contact
 then raise exception 'Somente TORNADO original (109, custo 0, embaralhar e comprar 2) está habilitado';end if;
 if not exists(select 1 from public.chaotic_preview_card_reference c
  where c.kind='attack' and c.card_id='109' and c.card_name='TORNADO'
   and c.base_damage=0 and c.attack_cost=0
   and c.effect_text='Seu oponente embaralha a mão de cartas de ataque dele no monte e depois compra 2 cartas. Só pode ser usado se o seu campeão ativo tiver o elemento Ar.')
 then raise exception 'Referência original do TORNADO 109 alterada';end if;
 select * into meta from public.chaotic_preview_3x3_elemental_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into creature from public.chaotic_preview_3x3_creature_element_checks
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if meta.lobby_id is null or creature.lobby_id is null
  or meta.attack_instance_id is distinct from w.attack_instance_id
  or meta.catalog_attack_id<>'109' or meta.base_damage<>0
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
 -- The attacker must have natural Ar, as verified by the
 -- original creature catalog and current attacker's authenticated slot.
 if creature.attacker_base_elements is null
  or pg_catalog.jsonb_typeof(creature.attacker_base_elements)<>'array'
  or not (creature.attacker_base_elements ? 'ar')
 then raise exception 'TORNADO exige elemento Ar natural no campeão atacante';end if;
 -- The opponent's deck must be prepared before allowing payment.
 select * into target_wallet from public.chaotic_preview_3x3_attack_wallets
 where lobby_id=p_lobby_id and actor_id=w.defender_id for update;
 if not found or target_wallet.total_cards not between 3 and 20
 then raise exception 'Mão adversária não preparada para TORNADO';end if;
 select count(*),count(*) filter(where card_state='hand')
 into total_count,hand_count
 from public.chaotic_preview_3x3_attack_hand
 where lobby_id=p_lobby_id and actor_id=w.defender_id;
 if total_count<>target_wallet.total_cards or hand_count>5
 then raise exception 'Baralho adversário inconsistente para TORNADO';end if;
 shuffled_count:=hand_count;
 -- All cards currently in the hand return to their original owner's
 -- training deck; existing deck entries join the same random shuffle.
 update public.chaotic_preview_3x3_attack_hand
 set card_state='deck',draw_cycle=target_wallet.recycle_cycles,
     recycle_priority=pg_catalog.gen_random_uuid()
 where lobby_id=p_lobby_id and actor_id=w.defender_id
    and card_state in('hand','deck');
 -- Draw no more than two. This intentionally does NOT touch spent
 -- cards, the album, the owner's Deck membership, HP or currencies.
 for i in 1..2 loop
   select * into victim_card
   from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=w.defender_id
    and card_state='deck'
   order by draw_cycle,recycle_priority nulls first,draw_position
   limit 1 for update;
   if not found then exit;end if;
   update public.chaotic_preview_3x3_attack_hand
     set card_state='hand'
   where lobby_id=p_lobby_id and actor_id=w.defender_id
     and card_slot=victim_card.card_slot and card_state='deck';
   if not found then raise exception 'Compra do TORNADO conflitou com outra ação';end if;
   drawn_count:=drawn_count+1;
 end loop;
 before_hp:=hp_def.hp_remaining;
 after_hp:=before_hp;
 insert into public.chaotic_preview_3x3_training_damage_events(
  lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,catalog_attack_id,base_damage,hp_before,hp_after,
  damage_dealt,optional_reveal_pending,effects_fully_resolved,
  tornado_shuffled_count,tornado_drawn_count
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,w.attacker_slot,w.defender_slot,
  w.attack_instance_id,'109',0,before_hp,after_hp,0,false,true,
  shuffled_count,drawn_count
 ) returning * into event_row;
 update public.chaotic_preview_3x3_attack_spends
  set training_damage_applied=true,
      resolution_status='training_tornado_109_reshuffle_two_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 return event_row;
end;
$function$
;
revoke all on function public.chaotic_apply_preview_3x3_training_tornado_109(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_3x3_training_tornado_109(uuid,integer) to authenticated;
commit;
