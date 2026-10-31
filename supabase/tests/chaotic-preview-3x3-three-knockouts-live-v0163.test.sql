-- Chaotic GO v0.1.63: END-TO-END DB test of three genuinely settled 3x3 knockouts.
-- ALL fake accounts/rooms/cards/HP are rolled back. No production player is touched.
begin;
do $verify$
declare
 host uuid:='a1630000-0000-4000-8000-000000000163';
 guest uuid:='b1630000-0000-4000-8000-000000000163';
 room uuid:=gen_random_uuid();
 i int; t int; slot int; instance text; err text; pong jsonb;
 dmg public.chaotic_preview_3x3_training_damage_events;
begin
 insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
 values(host,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','chaotic-ko-v163-host@example.invalid',now(),now()),
 (guest,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','chaotic-ko-v163-guest@example.invalid',now(),now());
 insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
 values(room,upper(left(replace(room::text,'-',''),12)),host,guest,'3x3','ready');
 insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
 values(room,host,guest,host,1);
 insert into public.chaotic_preview_3x3_allies
 (lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,starting_tokens,remaining_tokens)
 select room,actor,pos,1, (case when actor=host then 'H' else 'G' end)||pos::text,
 case pos when 4 then 'Johnes' when 5 then 'Promos' else 'Alakazaz' end,
 case pos when 4 then 2 when 5 then 3 else 5 end,
 case pos when 4 then 2 when 5 then 3 else 5 end
 from (select x.actor,y.pos from (values(host),(guest)) x(actor) cross join (values(4),(5),(6)) y(pos)) s;
 insert into public.chaotic_preview_3x3_hp_wallets
 (lobby_id,actor_id,position,creature_instance_id,creature_name,hp_initial,hp_max,hp_remaining,initialized_turn,damage_events)
 select room,actor_id,position,creature_instance_id,creature_name,
 case when actor_id=guest then 5 else 20 end,case when actor_id=guest then 5 else 20 end,
 case when actor_id=guest then 5 else 20 end,1,0
 from public.chaotic_preview_3x3_allies where lobby_id=room;
 insert into public.chaotic_preview_3x3_board_positions
 (lobby_id,actor_id,formation_slot,creature_instance_id,hex_position)
 select room,actor_id,position,creature_instance_id,
 case position when 4 then 4 when 5 then 5 else 1 end
 from public.chaotic_preview_3x3_allies where lobby_id=room;
 insert into public.chaotic_preview_3x3_attack_wallets
 (lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
 values(room,host,1,1,1,3);
 for i in 1..3 loop
  t:=2*i-1; slot:=i+3; instance:='attack-v163-'||i;
  perform set_config('request.jwt.claim.sub',host::text,true);
  -- Isolate this test to damage/outcome semantics: staged movement of
  -- a synthetic defeated unit clears the shared 4-5 contact lane.
  if i=2 then
   update public.chaotic_preview_3x3_board_positions set hex_position=6
    where lobby_id=room and actor_id=guest and formation_slot=4;
   update public.chaotic_preview_3x3_board_positions set hex_position=4
    where lobby_id=room and actor_id=guest and formation_slot=5;
  elsif i=3 then
   update public.chaotic_preview_3x3_board_positions set hex_position=5
    where lobby_id=room and actor_id=guest and formation_slot=5;
   update public.chaotic_preview_3x3_board_positions set hex_position=4
    where lobby_id=room and actor_id=guest and formation_slot=6;
  end if;
  insert into public.chaotic_preview_3x3_contact_intents
  (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
  values(room,t,host,guest,4,slot,'H4','G'||slot,4,4,20,5);
  insert into public.chaotic_preview_3x3_attack_projections
  (lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,attack_instance_id,
   catalog_attack_id,attack_name,base_damage,attack_cost,
   attacker_slot,defender_id,defender_slot,defender_hp_before,
   defender_hp_projected,projected_hp_loss,hypothetical_knockout)
  values(room,t,host,1,i,instance,'105','Vento Forte',5,1,4,guest,slot,5,0,5,true);
  insert into public.chaotic_preview_3x3_attack_hand
  (lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state,spent_turn,spent_reason)
  values(room,host,i,instance,i,'spent',t,'attack');
  insert into public.chaotic_preview_3x3_cost_inspections
  (lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
   attack_cost,points_available,can_afford,points_after_if_paid)
  values(room,t,host,instance,i,'105',1,10,true,9);
  insert into public.chaotic_preview_3x3_attack_spends
  (lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
   catalog_attack_id,training_attack_cost,points_before,points_after)
  values(room,t,host,1,i,instance,'105',1,10,9);
  insert into public.chaotic_preview_3x3_defense_windows
  (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,training_attack_cost,status,defender_passed_at)
  values(room,t,host,guest,4,slot,instance,1,'defender_passed_preview',now());
  insert into public.chaotic_preview_3x3_elemental_inspections
  (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,catalog_attack_id,attack_name,base_damage,
   fire_component,water_component,earth_component,air_component,
   special_resolution,attacker_hp_at_contact,defender_hp_at_contact)
  values(room,t,host,guest,4,slot,instance,'105','Vento Forte',5,0,0,0,0,'none',20,5);
  insert into public.chaotic_preview_3x3_creature_element_checks
  (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_creature_name,defender_creature_name,
   attacker_base_elements,defender_base_elements,
   fire_base_match,water_base_match,earth_base_match,air_base_match)
  values(room,t,host,guest,4,slot,'H4','G'||slot,'Johnes',
   case slot when 4 then 'Johnes' when 5 then 'Promos' else 'Alakazaz' end,
   '[]'::jsonb,'[]'::jsonb,false,false,false,false);
  insert into public.chaotic_preview_3x3_private_equipment_checks
  (lobby_id,turn_no,attacker_id,defender_id,defender_slot,
   defender_creature_instance_id,source_deck_slot,equipment_status)
  values(room,t,host,guest,slot,'G'||slot,1,'no_equipment_in_slot');
  dmg:=public.chaotic_apply_preview_3x3_training_base_105(room,t);
  if dmg.hp_after<>0 then raise exception 'No KO at turn %',t;end if;
  if (select count(*) from public.chaotic_preview_3x3_training_knockouts where lobby_id=room)<>i
   or (select count(*) from public.chaotic_preview_3x3_training_outcomes where lobby_id=room)<>(case when i=3 then 1 else 0 end)
  then raise exception 'Wrong KO/outcome at turn %',t;end if;
  if i<3 then
   perform public.chaotic_resolve_preview_3x3_vento_reveal(room,t,null,true);
   perform public.chaotic_pass_turn(room,t);
   perform set_config('request.jwt.claim.sub',guest::text,true);
   perform public.chaotic_pass_turn(room,t+1);
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub',host::text,true);
 err:=null;
 begin perform public.chaotic_pass_turn(room,5);
 exception when others then get stacked diagnostics err=message_text;end;
 if err is null or position('já teve vencedor' in err)=0
 then raise exception 'Post-victory extra turn accepted: %',err;end if;
 pong:=public.chaotic_ping_preview_3x3_player(room,null);
 if (pong->>'training_finished')::boolean is not true or
    (pong->>'you_won_training')::boolean is not true
 then raise exception 'Host did not read win: %',pong;end if;
 perform set_config('request.jwt.claim.sub',guest::text,true);
 pong:=public.chaotic_ping_preview_3x3_player(room,null);
 if (pong->>'training_finished')::boolean is not true or
    (pong->>'you_won_training')::boolean is not false
 then raise exception 'Guest did not read loss: %',pong;end if;
 if (public.chaotic_stop_match(room)).status<>'finished'
 then raise exception 'Guest cannot close test';end if;
 if (select official_match_ended or experience_awarded or currency_awarded
     from public.chaotic_preview_3x3_training_outcomes where lobby_id=room)
 then raise exception 'Training illegally changed official rewards';end if;
end $verify$;
rollback;
select 'PASS v0.1.63: 3 consecutive actual KOs over turns 1,3,5, host/guest agree, no replay, rolled back' as result;
