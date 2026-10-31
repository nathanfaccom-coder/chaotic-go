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
select lobby_id,actor_id,position,creature_instance_id,creature_name,20,20,20,1,0
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
do $ko183$
declare
 room uuid:='d1730000-0000-4000-8000-000000000173';
 borrower uuid:='a1730000-0000-4000-8000-000000000173';
 defender uuid:='b1730000-0000-4000-8000-000000000173';
 loan uuid:='e1730000-0000-4000-8000-000000000173';
 result jsonb;
 denied boolean;
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',borrower::text,true);
 perform public.chaotic_prepare_preview_3x3_borrowed_105(room,loan,3);
 perform public.chaotic_open_preview_3x3_borrowed_105_priority(room,3);
 denied:=false;
 begin perform public.chaotic_settle_preview_3x3_borrowed_105_base(room,3);
 exception when others then denied:=true;end;
 if not denied then raise exception 'KO accepted without defender pass';end if;
 perform pg_catalog.set_config('request.jwt.claim.sub',defender::text,true);
 perform public.chaotic_pass_preview_3x3_borrowed_105_priority(room,3);
 perform pg_catalog.set_config('request.jwt.claim.sub',borrower::text,true);
 result:=public.chaotic_settle_preview_3x3_borrowed_105_base(room,3);
 if result->>'status'<>'base_resolved_no_optional_reveal'
  or result->>'points_before'<>'4' or result->>'points_after'<>'3'
  or result->>'hp_before'<>'5' or result->>'hp_after'<>'0'
  or result->>'borrowed_card_returned'<>'true'
  or (select hp_remaining from public.chaotic_preview_3x3_hp_wallets
     where lobby_id=room and actor_id=defender and position=4)<>0
  or (select spent_points from public.chaotic_preview_3x3_attack_wallets
     where lobby_id=room and actor_id=borrower)<>1
  or (select count(*) from public.chaotic_preview_3x3_borrowed_105_knockouts
     where lobby_id=room and defender_id=defender and defender_slot=4)<>1
  or (select hp_before from public.chaotic_preview_3x3_borrowed_105_knockouts
     where lobby_id=room and defender_id=defender and defender_slot=4)<>5
  or (select count(*) from public.chaotic_preview_3x3_training_knockouts where lobby_id=room)<>0
  or (select count(*) from public.chaotic_preview_3x3_training_outcomes where lobby_id=room)<>0
  or (select custody_state from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>'released'
  or (select card_state from public.chaotic_preview_3x3_attack_hand
     where lobby_id=room and actor_id=defender and card_slot=1)<>'deck'
  or (select count(*) from public.chaotic_preview_3x3_borrowed_105_base_events where lobby_id=room)<>1
 then raise exception 'Borrowed KO was not atomic: %',result;end if;
 denied:=false;
 begin perform public.chaotic_settle_preview_3x3_borrowed_105_base(room,3);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Borrowed KO replay accepted';end if;
 -- Since v0.1.85, each nonterminal paid borrowed 105 must explicitly
 -- resolve or skip its optional reveal before advancing the turn.
 perform public.chaotic_resolve_preview_3x3_borrowed_105_reveal(room,3,null,true);
 perform public.chaotic_pass_turn(room,3);
 if (select turn_no from public.chaotic_match_turns where lobby_id=room)<>4
 then raise exception 'Single-target borrowed KO blocked turn';end if;
 if (select data->0->>'id' from public.chaotic_game_nodes
     where user_id=defender and node_path='album')<>'G1'
 then raise exception 'Original borrowed card album modified';end if;
end;
$ko183$;
rollback;
select 'PASS 0.1.83 individual borrowed Vento Forte KO, 1 point, 5 HP, original card returned, no replay, next turn' as result;