-- Chaotic GO v0.1.70: original Fogo Primordial 2.0 server d6, one 104 KO, two 105 KOs.
-- ALL fake accounts/rooms/cards/HP are rolled back. No production player is touched.
begin;
do $verify$
declare
 status_snapshot jsonb;
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
 -- An unknown JWT subject cannot inspect a room or its attack checkpoint.
 perform set_config('request.jwt.claim.sub','d1660000-0000-4000-8000-000000000166',true);
 err:=null;
 begin perform public.chaotic_get_preview_3x3_resume_status(room);
 exception when others then get stacked diagnostics err=message_text;end;
 if err is null or position('dois membros' in err)=0 then
   raise exception 'Outsider read private recovery checkpoint: %',err;end if;
 perform set_config('request.jwt.claim.sub',host::text,true);
 status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
 if status_snapshot->>'phase'<>'ready' or status_snapshot->>'turn_no'<>'1'
 then raise exception 'Room created with a fake pending attack: %',status_snapshot;end if;
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
  if i=1 then
   -- Cancel a contact opened with no card at all. No refund or fake rollback
   -- of the public champion reveal; a cancelled contact never costs points.
   status_snapshot:=public.chaotic_cancel_preview_3x3_unpaid_contact(room,t);
   if status_snapshot->>'status'<>'unpaid_contact_cancelled'
      or (status_snapshot->>'points_refunded')::integer<>0
      or (select count(*) from public.chaotic_preview_3x3_contact_intents
          where lobby_id=room and turn_no=t)<>0
   then raise exception 'Bare contact cannot be safely cancelled: %',status_snapshot;end if;
   insert into public.chaotic_preview_3x3_contact_intents
   (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
    attacker_creature_instance_id,defender_creature_instance_id,
    attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
   values(room,t,host,guest,4,slot,'H4','G'||slot,4,4,20,5);
   -- Original 104 requires a die; the 3x3 training damage resolver does not
   -- implement that roll. A preview is allowed, but spending is rejected.
   insert into public.chaotic_preview_3x3_attack_projections
   (lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,attack_instance_id,
    catalog_attack_id,attack_name,base_damage,attack_cost,
    attacker_slot,defender_id,defender_slot,defender_hp_before,
    defender_hp_projected,projected_hp_loss,hypothetical_knockout)
   values(room,t,host,1,1,'preview-only-104','104','Fogo Primordial 2.0',
     5,2,4,guest,slot,5,0,5,true);
   err:=null;
   begin perform public.chaotic_spend_preview_3x3_attack(room,t);
   exception when others then get stacked diagnostics err=message_text;end;
   if err is null then raise exception 'Unprepared 104 could be paid with no wallet/hand';end if;
   perform set_config('request.jwt.claim.sub',guest::text,true);
   err:=null;
   begin perform public.chaotic_cancel_preview_3x3_unpaid_contact(room,t);
   exception when others then get stacked diagnostics err=message_text;end;
   if err is null then raise exception 'Defender cancelled attacker contact';end if;
   perform set_config('request.jwt.claim.sub',host::text,true);
   status_snapshot:=public.chaotic_cancel_preview_3x3_unpaid_contact(room,t);
   if (select count(*) from public.chaotic_preview_3x3_attack_projections
       where lobby_id=room and turn_no=t)<>0
     or (select count(*) from public.chaotic_preview_3x3_attack_spends
       where lobby_id=room and turn_no=t)<>0
   then raise exception 'Unpaid 104 projection or spend survived cancellation';end if;
   if (select spent_points from public.chaotic_preview_3x3_attack_wallets
       where lobby_id=room and actor_id=host)<>0
   then raise exception 'Unsupported 104 spent training points';end if;
   -- Prove turn remains active, and supported Vento Forte may be declared
   -- afterward. Card/deck/HP are unchanged; reveal info is not hidden again.
   insert into public.chaotic_preview_3x3_contact_intents
   (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
    attacker_creature_instance_id,defender_creature_instance_id,
    attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
   values(room,t,host,guest,4,slot,'H4','G'||slot,4,4,20,5);
  end if;
  -- Race A: a delayed phone tries to end the turn after making contact
  -- but before choosing/paying for an attack. Turn must remain unchanged.
  err:=null;
  begin perform public.chaotic_pass_turn(room,t);
  exception when others then get stacked diagnostics err=message_text;end;
  if err is null or position('Contato 3x3 pendente' in err)=0
  then raise exception 'Contact-only action was skipped: %',err;end if;
  if (select turn_no from public.chaotic_match_turns where lobby_id=room)<>t
  then raise exception 'Contact-only premature pass changed turn';end if;
  insert into public.chaotic_preview_3x3_attack_projections
  (lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,attack_instance_id,
   catalog_attack_id,attack_name,base_damage,attack_cost,
   attacker_slot,defender_id,defender_slot,defender_hp_before,
   defender_hp_projected,projected_hp_loss,hypothetical_knockout)
  values(room,t,host,1,i,instance,case when i=1 then '104' else '105' end,
 case when i=1 then 'Fogo Primordial 2.0' else 'Vento Forte' end,5,
 case when i=1 then 2 else 1 end,4,guest,slot,5,0,5,true);
  -- Race B: an attack projection has been created, but payment has not.
  err:=null;
  begin perform public.chaotic_pass_turn(room,t);
  exception when others then get stacked diagnostics err=message_text;end;
  if err is null or position('Contato 3x3 pendente' in err)=0
  then raise exception 'Unpaid attack projection was skipped: %',err;end if;
  if (select turn_no from public.chaotic_match_turns where lobby_id=room)<>t
  then raise exception 'Unpaid premature pass changed turn';end if;
  insert into public.chaotic_preview_3x3_attack_hand
  (lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state,spent_turn,spent_reason)
  values(room,host,i,instance,i,case when i=1 then 'hand' else 'spent' end,
   case when i=1 then null else t end,case when i=1 then null else 'attack' end);
  insert into public.chaotic_preview_3x3_cost_inspections
  (lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
   attack_cost,points_available,can_afford,points_after_if_paid)
  values(room,t,host,instance,i,case when i=1 then '104' else '105' end,
 case when i=1 then 2 else 1 end,
 case when i=1 then 3 else 10 end,true,
 case when i=1 then 1 else 9 end);
  -- Refresh on a freshly opened, not-yet-paid attack must be safe.
  status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
  if status_snapshot->>'phase'<>'awaiting_payment'
    or (status_snapshot->>'your_action_required')::boolean is not true
  then raise exception 'Unpaid attack checkpoint invalid at turn %: %',t,status_snapshot;end if;
  if i=1 then
   perform public.chaotic_spend_preview_3x3_attack(room,t);
   if (select spent_points from public.chaotic_preview_3x3_attack_wallets
      where lobby_id=room and actor_id=host)<>2
      or (select card_state from public.chaotic_preview_3x3_attack_hand
       where lobby_id=room and actor_id=host and card_slot=i)<>'spent'
      or (select points_after from public.chaotic_preview_3x3_attack_spends
       where lobby_id=room and turn_no=t)<>1
   then raise exception 'Original Fogo 104 payment was not atomic';end if;
  else
   insert into public.chaotic_preview_3x3_attack_spends
   (lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
    catalog_attack_id,training_attack_cost,points_before,points_after)
   values(room,t,host,1,i,instance,'105',1,10,9);
  end if;
  if i=1 then
   err:=null;
   begin perform public.chaotic_cancel_preview_3x3_unpaid_contact(room,t);
   exception when others then get stacked diagnostics err=message_text;end;
   if err is null or position('Pagamento, defesa ou dano' in err)=0
   then raise exception 'Paid original attack can be erased: %',err;end if;
  end if;
  insert into public.chaotic_preview_3x3_defense_windows
  (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,training_attack_cost,status,defender_passed_at)
  values(room,t,host,guest,4,slot,instance,case when i=1 then 2 else 1 end,'awaiting_defender',null);
  -- Host and guest see the SAME server phase, but distinct action rights.
  status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
  if status_snapshot->>'phase'<>'awaiting_defender'
    or (status_snapshot->>'your_action_required')::boolean is true
  then raise exception 'Host incorrectly allowed to respond: %',status_snapshot;end if;
  err:=null;
  begin perform public.chaotic_pass_turn(room,t);
  exception when others then get stacked diagnostics err=message_text;end;
  if err is null or position('Aguarde o defensor' in err)=0
  then raise exception 'Host bypassed unanswered defense: %',err;end if;
  perform set_config('request.jwt.claim.sub',guest::text,true);
  status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
  if status_snapshot->>'phase'<>'awaiting_defender'
    or (status_snapshot->>'your_action_required')::boolean is not true
    or (status_snapshot->>'your_turn')::boolean is true
  then raise exception 'Reconnecting defender not instructed to act: %',status_snapshot;end if;
  perform public.chaotic_pass_preview_3x3_defense(room,t);
  err:=null;
  begin perform public.chaotic_pass_preview_3x3_defense(room,t);
  exception when others then get stacked diagnostics err=message_text;end;
  if err is null then raise exception 'Duplicate defense accepted at turn %',t;end if;
  status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
  if status_snapshot->>'phase'<>'awaiting_damage'
    or (status_snapshot->>'your_action_required')::boolean is true
  then raise exception 'Defender can apply damage: %',status_snapshot;end if;
  perform set_config('request.jwt.claim.sub',host::text,true);
  status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
  if status_snapshot->>'phase'<>'awaiting_damage'
    or (status_snapshot->>'your_action_required')::boolean is not true
  then raise exception 'Host recovery after defense did not see damage: %',status_snapshot;end if;
  insert into public.chaotic_preview_3x3_elemental_inspections
  (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attack_instance_id,catalog_attack_id,attack_name,base_damage,
   fire_component,water_component,earth_component,air_component,
   special_resolution,attacker_hp_at_contact,defender_hp_at_contact)
  values(room,t,host,guest,4,slot,instance,case when i=1 then '104' else '105' end,
 case when i=1 then 'Fogo Primordial 2.0' else 'Vento Forte' end,5,
 case when i=1 then 5 else 0 end,0,0,0,
 case when i=1 then 'six_sided_base_multiplier' else 'none' end,20,5);
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
  if i=1 then
    perform set_config('request.jwt.claim.sub',guest::text,true);
    err:=null;
    begin perform public.chaotic_apply_preview_3x3_training_fire_104(room,t);
    exception when others then get stacked diagnostics err=message_text;end;
    if err is null then raise exception 'Defender rolled attacker die';end if;
    perform set_config('request.jwt.claim.sub',host::text,true);
    dmg:=public.chaotic_apply_preview_3x3_training_fire_104(room,t);
    if dmg.catalog_attack_id<>'104'
      or dmg.fire_die_roll not between 1 and 6
      or dmg.base_damage<>5*dmg.fire_die_roll
      or dmg.damage_dealt<>5
      or dmg.optional_reveal_pending
      or not dmg.effects_fully_resolved
    then raise exception '104 die not persisted correctly: %',row_to_json(dmg);end if;
  else
    dmg:=public.chaotic_apply_preview_3x3_training_base_105(room,t);
  end if;
  if dmg.hp_after<>0 then raise exception 'No KO at turn %',t;end if;
  status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
  if status_snapshot->>'phase'<>(case when i=3 then 'training_finished' when i=1 then 'damage_settled' else 'awaiting_optional_reveal' end)
  then raise exception 'Post-damage recovery phase incorrect at turn %: %',t,status_snapshot;end if;
  err:=null;
  begin
    if i=1 then perform public.chaotic_apply_preview_3x3_training_fire_104(room,t);
    else perform public.chaotic_apply_preview_3x3_training_base_105(room,t);end if;
  exception when others then get stacked diagnostics err=message_text;end;
  if err is null or position('antirreplay' in err)=0
  then raise exception 'Post-reconnect damage replay accepted: %',err;end if;
  if (select count(*) from public.chaotic_preview_3x3_training_damage_events
      where lobby_id=room and turn_no=t)<>1
   or (select hp_remaining from public.chaotic_preview_3x3_hp_wallets
      where lobby_id=room and actor_id=guest and position=slot)<>0
  then raise exception 'Reconnection altered damage/HP for turn %',t;end if;
  if (select count(*) from public.chaotic_preview_3x3_training_knockouts where lobby_id=room)<>i
   or (select count(*) from public.chaotic_preview_3x3_training_outcomes where lobby_id=room)<>(case when i=3 then 1 else 0 end)
  then raise exception 'Wrong KO/outcome at turn %',t;end if;
  if i<3 then
   if i<>1 then perform public.chaotic_resolve_preview_3x3_vento_reveal(room,t,null,true);end if;
   status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
   if status_snapshot->>'phase'<>'damage_settled'
   then raise exception 'Resolved optional action was not persisted: %',status_snapshot;end if;
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
 status_snapshot:=public.chaotic_get_preview_3x3_resume_status(room);
 if status_snapshot->>'phase'<>'training_finished'
   or (status_snapshot->>'you_won_training')::boolean is not false
   or (status_snapshot->>'your_action_required')::boolean is true
 then raise exception 'Guest did not recover final defeat: %',status_snapshot;end if;
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
select 'PASS v0.1.70: actual paid 104 (2 points), authoritative 1d6, KO, blocked replay; two 105 KOs; rolled back' as result;
