-- Retained historical regression slot: lethal attack is now supported as a terminal outcome in v0.1.84.
-- Its fail-closed regression now tests a malformed second borrowed card instead of denying valid final KOs.
-- Chaotic GO 0.1.73 temporary custody: RLS + read-only, transaction rolled back.
begin;
insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',label||'@example.invalid',now(),now()
from (values
('a1730000-0000-4000-8000-000000000173'::uuid,'custody-owner-v173'),
('b1730000-0000-4000-8000-000000000173'::uuid,'custody-borrower-v173'),
('c1730000-0000-4000-8000-000000000173'::uuid,'custody-outsider-v173')) v(id,label);
insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
values('d1730000-0000-4000-8000-000000000173','A17300000001',
'a1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173','3x3','ready');
insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
values('d1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173',1);
-- Build real 3x3 encounter and both real hands for readiness.
insert into public.chaotic_preview_3x3_allies
(lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,starting_tokens,remaining_tokens)
select 'd1730000-0000-4000-8000-000000000173',x.actor,x.pos,1,
 (case when x.actor='a1730000-0000-4000-8000-000000000173'::uuid then 'H' else 'G' end)||x.pos,
 case x.pos when 4 then 'Johnes' when 5 then 'Promos' else 'Alakazaz' end,2,2
from (select a.actor,b.pos from
 (values ('a1730000-0000-4000-8000-000000000173'::uuid),
         ('b1730000-0000-4000-8000-000000000173'::uuid)) a(actor)
 cross join (values(4),(5),(6)) b(pos)) x;
insert into public.chaotic_preview_3x3_hp_wallets
(lobby_id,actor_id,position,creature_instance_id,creature_name,hp_initial,hp_max,hp_remaining,initialized_turn,damage_events)
select lobby_id,actor_id,position,creature_instance_id,creature_name,20,20,
case when actor_id='b1730000-0000-4000-8000-000000000173'::uuid and position in(5,6) then 0 else 20 end,
1,case when actor_id='b1730000-0000-4000-8000-000000000173'::uuid and position in(5,6) then 1 else 0 end
from public.chaotic_preview_3x3_allies where lobby_id='d1730000-0000-4000-8000-000000000173';
insert into public.chaotic_preview_3x3_board_positions
(lobby_id,actor_id,formation_slot,creature_instance_id,hex_position)
select lobby_id,actor_id,position,creature_instance_id,position
from public.chaotic_preview_3x3_allies where lobby_id='d1730000-0000-4000-8000-000000000173';
insert into public.chaotic_preview_3x3_attack_wallets
(lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
values ('d1730000-0000-4000-8000-000000000173','a1730000-0000-4000-8000-000000000173',1,1,1,3),
 ('d1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173',1,1,1,3);
insert into public.chaotic_preview_3x3_attack_hand
(lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state)
select 'd1730000-0000-4000-8000-000000000173'::uuid,x.actor,x.slot,
 (case when x.actor='a1730000-0000-4000-8000-000000000173'::uuid then 'H' else 'G' end)||x.slot,
 x.slot,case when x.slot=1 then 'hand' else 'deck' end
from (select a.actor,b.slot from
 (values ('a1730000-0000-4000-8000-000000000173'::uuid),
         ('b1730000-0000-4000-8000-000000000173'::uuid)) a(actor)
 cross join (values(1),(2),(3)) b(slot)) x;
insert into public.chaotic_preview_3x3_contact_intents
(lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
attacker_creature_instance_id,defender_creature_instance_id,
attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
values('d1730000-0000-4000-8000-000000000173',1,
'a1730000-0000-4000-8000-000000000173',
'b1730000-0000-4000-8000-000000000173',4,4,'H4','G4',4,4,20,20);

insert into public.chaotic_game_nodes(user_id,node_path,data)
values('b1730000-0000-4000-8000-000000000173','album',
 '[{"id":"G1","tipoCarta":"Ataque","nome":"Vento Forte","quantidade":1}]'::jsonb);
update public.chaotic_preview_3x3_attack_hand set card_state='loaned'
where lobby_id='d1730000-0000-4000-8000-000000000173'
 and actor_id='b1730000-0000-4000-8000-000000000173' and card_slot=1;
insert into public.chaotic_preview_3x3_temporary_card_custody(
 id,lobby_id,source_actor_id,borrower_id,source_card_slot,
 source_attack_instance_id,catalog_attack_id,granted_turn,custody_state
) values(
 'e1730000-0000-4000-8000-000000000173',
 'd1730000-0000-4000-8000-000000000173',
 'b1730000-0000-4000-8000-000000000173',
 'a1730000-0000-4000-8000-000000000173',
 1,'G1','105',1,'held'
);

update public.chaotic_match_turns set turn_no=3,current_player='a1730000-0000-4000-8000-000000000173'
 where lobby_id='d1730000-0000-4000-8000-000000000173';
update public.chaotic_preview_3x3_attack_wallets set last_draw_turn=3
 where lobby_id='d1730000-0000-4000-8000-000000000173'
 and actor_id='a1730000-0000-4000-8000-000000000173';
insert into public.chaotic_preview_3x3_contact_intents
(lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
 attacker_creature_instance_id,defender_creature_instance_id,
 attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
values('d1730000-0000-4000-8000-000000000173',3,
 'a1730000-0000-4000-8000-000000000173',
 'b1730000-0000-4000-8000-000000000173',
 4,4,'H4','G4',4,4,20,20);

insert into public.chaotic_game_nodes(user_id,node_path,data)
values('b1730000-0000-4000-8000-000000000173','decks/3x3_slot_1',
 '{"criaturas":[null,null,null,"G4","G5","G6"],"equipamentos":[null,null,null,null,null,null]}'::jsonb);
update public.chaotic_preview_3x3_hp_wallets
 set hp_remaining=5,damage_events=1
 where lobby_id='d1730000-0000-4000-8000-000000000173'
  and actor_id='b1730000-0000-4000-8000-000000000173'
  and position=4;
update public.chaotic_preview_3x3_contact_intents
 set defender_hp_at_contact=5
 where lobby_id='d1730000-0000-4000-8000-000000000173'
  and turn_no=3;
-- Another temporary loan was opened during another training turn.
update public.chaotic_game_nodes set data=data||
 '[{"id":"G2","tipoCarta":"Ataque","nome":"Vento Forte","quantidade":1}]'::jsonb
 where user_id='b1730000-0000-4000-8000-000000000173' and node_path='album';
update public.chaotic_preview_3x3_attack_hand set card_state='loaned'
 where lobby_id='d1730000-0000-4000-8000-000000000173'
 and actor_id='b1730000-0000-4000-8000-000000000173' and card_slot=2;
insert into public.chaotic_preview_3x3_temporary_card_custody(
 id,lobby_id,source_actor_id,borrower_id,source_card_slot,
 source_attack_instance_id,catalog_attack_id,granted_turn,custody_state
) values(
 'e1840000-0000-4000-8000-000000000184',
 'd1730000-0000-4000-8000-000000000173',
 'b1730000-0000-4000-8000-000000000173',
 'a1730000-0000-4000-8000-000000000173',
 2,'G2','105',2,'held');
do $abort184$
declare room uuid:='d1730000-0000-4000-8000-000000000173';
 host uuid:='a1730000-0000-4000-8000-000000000173';
 guest uuid:='b1730000-0000-4000-8000-000000000173';
 cid uuid:='e1730000-0000-4000-8000-000000000173';
 denied boolean:=false;
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',host::text,true);
 perform public.chaotic_prepare_preview_3x3_borrowed_105(room,cid,3);
 perform public.chaotic_open_preview_3x3_borrowed_105_priority(room,3);
 perform pg_catalog.set_config('request.jwt.claim.sub',guest::text,true);
 perform public.chaotic_pass_preview_3x3_borrowed_105_priority(room,3);
 -- Simulate divergence AFTER all valid attack inspections: another
 -- temporarily loaned original suddenly has a mismatched card state.
 update public.chaotic_preview_3x3_attack_hand set card_state='deck'
  where lobby_id=room and actor_id=guest and card_slot=2;
 perform pg_catalog.set_config('request.jwt.claim.sub',host::text,true);
 begin
  perform public.chaotic_settle_preview_3x3_borrowed_105_base(room,3);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Corrupted second loan allowed training winner';end if;
 if (select spent_points from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=room and actor_id=host)<>0
  or (select hp_remaining from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=room and actor_id=guest and position=4)<>5
  or (select state from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=room and turn_no=3)<>'defender_passed_preview'
  or (select count(*) from public.chaotic_preview_3x3_temporary_card_custody
  where lobby_id=room and custody_state='held')<>2
  or (select card_state from public.chaotic_preview_3x3_attack_hand
  where lobby_id=room and actor_id=guest and card_slot=1)<>'loaned'
  or exists(select 1 from public.chaotic_preview_3x3_training_outcomes
  where lobby_id=room)
  or exists(select 1 from public.chaotic_preview_3x3_borrowed_105_knockouts
  where lobby_id=room)
  or exists(select 1 from public.chaotic_preview_3x3_borrowed_105_base_events
  where lobby_id=room)
 then raise exception 'Corrupted second loan caused partial charge, HP, KO, or winner';end if;
end;
$abort184$;
rollback;
select 'PASS v0.1.84 corrupted second loan aborts terminal KO without charging, damage or first loan loss' result;