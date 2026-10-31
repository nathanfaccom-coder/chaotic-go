-- Chaotic GO 0.1.51 — REAL transaction-level integration for the current five training attacks.
-- All fixture accounts, rooms, hands and HP are created in this transaction and ROLLED BACK.
-- Never run without BEGIN/ROLLBACK; never use production accounts or real saved cards.
begin;
do $integration$
declare
 host uuid:='a1510000-0000-4000-8000-000000000151';
 guest uuid:='a1510000-0000-4000-8000-000000000152';
 lobby uuid;
 attack_id text;
 attack_name text;
 base_damage int;
 cost int;
 prior_hp int;
 expected_hp int;
 expected_bonus int;
 effect public.chaotic_preview_3x3_training_damage_events;
 current_hp integer;
 knockout_count integer;
 status_after text;
 i int;
begin
 insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
 values(host,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'chaotic-test-v51-host@example.invalid',now(),now()),
 (guest,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'chaotic-test-v51-guest@example.invalid',now(),now());

 for i in 1..5 loop
  attack_id:=case i when 1 then '105' when 2 then '111'
    when 3 then '112' when 4 then '113' else '114' end;
  attack_name:=case i when 1 then 'Vento Forte' when 2 then 'MÃO ELETRÔNICA'
    when 3 then 'MÃO MÃO' when 4 then 'PURGATÓRIO' else 'ESQUELETO' end;
  base_damage:=case when i in (2,5) then 10 when i=4 then 0 else 5 end;
  cost:=case i when 1 or 3 then 1 when 2 then 3 when 4 then 0 else 2 end;
  -- ESQUELETO scenario: one ally already defeated, defender has 15 HP.
  prior_hp:=case when i=5 then 15 else 20 end;
  expected_bonus:=case when i=5 then 5 else 0 end;
  expected_hp:=greatest(0,prior_hp-base_damage-expected_bonus);
  lobby:=gen_random_uuid();

  insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
   values(lobby,upper(left(replace(lobby::text,'-',''),12)),host,guest,'3x3','ready');
  insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
   values(lobby,host,guest,host,1);

  insert into public.chaotic_preview_3x3_allies(
   lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,
   starting_tokens,remaining_tokens)
  select lobby,v.actor,v.pos,1,
   (case when v.actor=host then 'H' else 'G' end)||v.pos::text,
   case when v.pos=4 then 'Johnes' when v.pos=5 then 'Promos' else 'Alakazaz' end,
   case when v.pos=4 then 2 when v.pos=5 then 3 else 5 end,
   case when v.pos=4 then 2 when v.pos=5 then 3 else 5 end
  from (select a.actor,p.pos from (values(host),(guest)) a(actor)
    cross join (values(4),(5),(6)) p(pos)) v;

  insert into public.chaotic_preview_3x3_hp_wallets(
   lobby_id,actor_id,position,creature_instance_id,creature_name,
   hp_initial,hp_max,hp_remaining,initialized_turn,damage_events)
  select lobby,actor_id,position,creature_instance_id,creature_name,
    20,20,
    case when i=5 and actor_id=host and position=5 then 0
         when actor_id=guest and position=4 then prior_hp else 20 end,
    1,case when i=5 and actor_id=host and position=5 then 1
          when i=5 and actor_id=guest and position=4 then 1 else 0 end
  from public.chaotic_preview_3x3_allies where lobby_id=lobby;

  insert into public.chaotic_preview_3x3_board_positions(
   lobby_id,actor_id,formation_slot,creature_instance_id,hex_position)
  select lobby,actor_id,position,creature_instance_id,
    case when position=4 then 4 else position-4 end
  from public.chaotic_preview_3x3_allies where lobby_id=lobby;

  insert into public.chaotic_preview_3x3_contact_intents(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
  values(lobby,1,host,guest,4,4,'H4','G4',4,4,20,prior_hp);

  insert into public.chaotic_preview_3x3_attack_projections(
   lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,
   attack_instance_id,catalog_attack_id,attack_name,base_damage,attack_cost,
   attacker_slot,defender_id,defender_slot,defender_hp_before,
   defender_hp_projected,projected_hp_loss,hypothetical_knockout)
  values(lobby,1,host,1,1,'attack-test-'||attack_id,attack_id,attack_name,
   base_damage,cost,4,guest,4,prior_hp,greatest(0,prior_hp-base_damage),
   least(prior_hp,base_damage),prior_hp<=base_damage);

  insert into public.chaotic_preview_3x3_attack_wallets(
    lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
  values(lobby,host,1,1,1,3);

  insert into public.chaotic_preview_3x3_attack_hand(
   lobby_id,actor_id,card_slot,attack_instance_id,draw_position,
   card_state,spent_turn,spent_reason)
  values(lobby,host,1,'attack-test-'||attack_id,1,'spent',1,'attack');

  insert into public.chaotic_preview_3x3_cost_inspections(
   lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
   attack_cost,points_available,can_afford,points_after_if_paid)
  values(lobby,1,host,'attack-test-'||attack_id,1,attack_id,cost,10,true,10-cost);

  insert into public.chaotic_preview_3x3_attack_spends(
   lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
   catalog_attack_id,training_attack_cost,points_before,points_after)
  values(lobby,1,host,1,1,'attack-test-'||attack_id,attack_id,cost,10,10-cost);

  insert into public.chaotic_preview_3x3_defense_windows(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,training_attack_cost,status,defender_passed_at)
  values(lobby,1,host,guest,4,4,'attack-test-'||attack_id,
   cost,'defender_passed_preview',now());

  insert into public.chaotic_preview_3x3_elemental_inspections(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,catalog_attack_id,attack_name,base_damage,
   fire_component,water_component,earth_component,air_component,
   special_resolution,attacker_hp_at_contact,defender_hp_at_contact)
  values(lobby,1,host,guest,4,4,'attack-test-'||attack_id,
   attack_id,attack_name,base_damage,0,0,0,0,'none',20,prior_hp);

  insert into public.chaotic_preview_3x3_creature_element_checks(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_creature_name,defender_creature_name,
   attacker_base_elements,defender_base_elements,
   fire_base_match,water_base_match,earth_base_match,air_base_match)
  values(lobby,1,host,guest,4,4,'H4','G4','Johnes','Johnes',
   '[]'::jsonb,'[]'::jsonb,false,false,false,false);

  insert into public.chaotic_preview_3x3_private_equipment_checks(
   lobby_id,turn_no,attacker_id,defender_id,defender_slot,
   defender_creature_instance_id,source_deck_slot,equipment_status)
  values(lobby,1,host,guest,4,'G4',1,'no_equipment_in_slot');

  perform set_config('request.jwt.claim.sub',host::text,true);
  if auth.uid() is distinct from host then raise exception 'JWT test identity missing';end if;

  if attack_id='105' then
   effect:=public.chaotic_apply_preview_3x3_training_base_105(lobby,1);
  elsif attack_id in ('111','112') then
   effect:=public.chaotic_apply_preview_3x3_training_attack_lock(lobby,1);
  else
   effect:=public.chaotic_apply_preview_3x3_training_fallen_allies(lobby,1);
  end if;

  select hp_remaining into current_hp
  from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=lobby and actor_id=guest and position=4;
  if effect.hp_before<>prior_hp or effect.hp_after<>expected_hp
     or current_hp<>expected_hp or effect.damage_dealt<>prior_hp-expected_hp
     or effect.catalog_attack_id<>attack_id
  then raise exception 'Incorrect HP/total for %: event %, actual %',
   attack_id,row_to_json(effect),current_hp;end if;

  select count(*) into knockout_count from public.chaotic_preview_3x3_training_knockouts
   where lobby_id=lobby;
  if knockout_count<>(case when expected_hp=0 then 1 else 0 end)
   then raise exception 'KO count wrong for %: %',attack_id,knockout_count;end if;

  select resolution_status into status_after
   from public.chaotic_preview_3x3_attack_spends where lobby_id=lobby;
  if status_after='paid_training_unresolved'
  then raise exception 'Attack % paid but unresolved',attack_id;end if;

  if attack_id='113' and (effect.damage_dealt<>0 or
    (select damage_events from public.chaotic_preview_3x3_hp_wallets
    where lobby_id=lobby and actor_id=guest and position=4)<>0)
  then raise exception 'Zero PURGATÓRIO created fake damage';end if;

  if attack_id in('111','112') and not exists(
   select 1 from public.chaotic_preview_3x3_training_attack_locks
    where lobby_id=lobby and blocked_turn_count=
      case when attack_id='111' then 2 else 1 end)
  then raise exception 'Future attack restriction was not recorded for %',attack_id;end if;
 end loop;
end $integration$;
rollback;
select 'PASS real DB integration: original attacks 105,111,112,113,114, 0 damage, 1 KO, HP and payment; fixtures rolled back' as result;