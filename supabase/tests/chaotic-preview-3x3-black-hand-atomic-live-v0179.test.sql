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
insert into public.chaotic_preview_3x3_attack_projections
(lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,attack_instance_id,
catalog_attack_id,attack_name,base_damage,attack_cost,
attacker_slot,defender_id,defender_slot,defender_hp_before,
defender_hp_projected,projected_hp_loss,hypothetical_knockout)
values('d1730000-0000-4000-8000-000000000173',1,
'a1730000-0000-4000-8000-000000000173',1,1,'H1',
'102','Mão Negra',0,0,4,'b1730000-0000-4000-8000-000000000173',4,20,20,0,false);
insert into public.chaotic_game_nodes(user_id,node_path,data)
values('b1730000-0000-4000-8000-000000000173','album',
 '[{"id":"G1","tipoCarta":"Ataque","nome":"Vento Forte","quantidade":1}]'::jsonb);
insert into public.chaotic_preview_3x3_cost_inspections
 (lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
 attack_cost,points_available,can_afford,points_after_if_paid)
values('d1730000-0000-4000-8000-000000000173',1,
 'a1730000-0000-4000-8000-000000000173','H1',1,'102',0,3,true,3);

do $test102$
declare
 room uuid:='d1730000-0000-4000-8000-000000000173';
 host uuid:='a1730000-0000-4000-8000-000000000173';
 guest uuid:='b1730000-0000-4000-8000-000000000173';
 paid public.chaotic_preview_3x3_attack_spends;
 receipt jsonb;
 loan uuid;
 blocked boolean;
begin
 perform pg_catalog.set_config('request.jwt.claim.sub',host::text,true);
 paid:=public.chaotic_pay_preview_3x3_black_hand(room,1);
 if paid.catalog_attack_id<>'102' or paid.training_attack_cost<>0
   or paid.points_before<>3 or paid.points_after<>3 or paid.training_damage_applied
 then raise exception '102 payment not zero or prematurely settled';end if;
 blocked:=false;
 begin
  perform public.chaotic_resolve_preview_3x3_black_hand(room,1);
 exception when others then blocked:=true;end;
 if not blocked then raise exception '102 stole attack without defender pass';end if;
 if exists(select 1 from public.chaotic_preview_3x3_temporary_card_custody
   where lobby_id=room) then raise exception 'Premature custody inserted';end if;
 perform public.chaotic_open_preview_3x3_defense_window(room,1);
 perform pg_catalog.set_config('request.jwt.claim.sub',guest::text,true);
 perform public.chaotic_pass_preview_3x3_defense(room,1);
 perform pg_catalog.set_config('request.jwt.claim.sub',host::text,true);
 receipt:=public.chaotic_resolve_preview_3x3_black_hand(room,1);
 loan:=(receipt->>'custody_id')::uuid;
 if (select source_actor_id from public.chaotic_preview_3x3_temporary_card_custody
   where id=loan)<>guest
   or (select borrower_id from public.chaotic_preview_3x3_temporary_card_custody
   where id=loan)<>host
   or (select catalog_attack_id from public.chaotic_preview_3x3_temporary_card_custody
   where id=loan)<>'105'
   or (select card_state from public.chaotic_preview_3x3_attack_hand
   where lobby_id=room and actor_id=guest and card_slot=1)<>'loaned'
   or (select card_state from public.chaotic_preview_3x3_attack_hand
   where lobby_id=room and actor_id=host and card_slot=1)<>'spent'
   or (select resolution_status from public.chaotic_preview_3x3_attack_spends
   where lobby_id=room and turn_no=1)<>'training_black_hand_102_borrow_resolved'
   or receipt->>'borrowed_attack_playable'<>'false'
   or receipt->>'damage_applied'<>'false'
 then raise exception '102 payment, defender priority or loan not atomic: %',receipt;end if;
 blocked:=false;
 begin
  perform public.chaotic_resolve_preview_3x3_black_hand(room,1);
 exception when others then blocked:=true;end;
 if not blocked then raise exception '102 duplicate resolution succeeded';end if;
 if (select count(*) from public.chaotic_preview_3x3_temporary_card_custody
   where lobby_id=room)<>1 then raise exception '102 replay created extra card';end if;
end;
$test102$;
rollback;
select 'PASS v0.1.79 102 zero-cost payment, defender reaction, random original loan, anti-replay, rollback' as result;